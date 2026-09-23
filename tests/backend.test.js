import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../server.js';
import { calculatePlan, RULES_VERSION } from '../simulator.js';
import { hashCredential } from '../backend/storage.js';

const sample = [
  { id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M5', district: 'Сарыарка' },
];
const environmentKeys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'OPENAI_API_KEY', 'AKIM_STORAGE_MODE'];

function configure(t, configured = true) {
  const original = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  for (const key of environmentKeys) delete process.env[key];
  process.env.AKIM_STORAGE_MODE = 'supabase';
  if (configured) {
    process.env.SUPABASE_URL = 'https://database.example.test';
    process.env.SUPABASE_SECRET_KEY = 'test-placeholder';
  }
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function serverFor(t) {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, { method = 'GET', body, credential } = {}) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method,
      headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
}

const ok = data => ({ ok: true, json: async () => data });

test('local backend routes report offline services and enforce methods, auth and body limits without provider calls', async t => {
  configure(t, false);
  const upstream = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request'); });
  const hit = await serverFor(t);
  const services = await hit('/api/services');
  assert.equal(services.status, 200);
  assert.deepEqual(services.body.storage, { configured: false, connected: false, error: 'STORAGE_NOT_CONFIGURED' });
  assert.equal(services.body.ai.configured, false);
  assert.equal(services.headers['cache-control'], 'no-store');
  assert.equal(services.headers['x-content-type-options'], 'nosniff');
  assert.equal((await hit('/api/player')).status, 401);
  assert.equal((await hit('/api/runs')).status, 401);
  assert.equal((await hit('/api/leaderboard')).body.error, 'STORAGE_NOT_CONFIGURED');
  assert.equal((await hit('/api/player', { method: 'POST', body: {} })).body.error, 'STORAGE_NOT_CONFIGURED');
  assert.equal((await hit('/api/runs', { method: 'POST', body: { plan: [] } })).status, 422);
  assert.equal((await hit('/api/player', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await hit('/api/player', { method: 'POST', body: { noise: 'x'.repeat(5000) } })).status, 413);
  for (const route of ['/api/services', '/api/player', '/api/runs', '/api/leaderboard']) {
    const wrongMethod = await hit(route, { method: 'DELETE' });
    assert.equal(wrongMethod.status, 405, route);
    assert.ok(wrongMethod.headers.allow);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('HTTP player, run history and ranking use server-calculated plans and hashed anonymous credentials', async t => {
  configure(t);
  let playerRow, savedRow, savedPayload;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname.replace('/rest/v1/', '');
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, body });
    if (path === 'akim_players' && options.method === 'POST') {
      playerRow = body;
      return ok(null);
    }
    if (path === 'akim_players') {
      const query = new URL(url).searchParams;
      if (query.get('limit') === '0') return ok([]);
      return ok(query.get('credential_hash') === `eq.${playerRow.credential_hash}` ? [playerRow] : []);
    }
    if (path === 'rpc/akim_save_run') {
      savedPayload = body;
      savedRow = { id: 'saved-run', player_id: body.p_player_id, score: body.p_score,
        delta: body.p_delta, cost: body.p_cost, plan: body.p_plan,
        created_at: '2026-09-23T00:00:00Z', rules_version: body.p_rules_version };
      return ok([savedRow]);
    }
    if (path === 'akim_runs') return ok(savedRow ? [savedRow] : []);
    if (path === 'rpc/akim_leaderboard') return ok(savedRow ? [{ rank: '1', player_id: playerRow.id,
      display_name: playerRow.display_name, score: savedRow.score, cost: savedRow.cost,
      created_at: savedRow.created_at }] : []);
    throw new Error(`Unexpected database path: ${path}`);
  });
  const hit = await serverFor(t);
  assert.equal((await hit('/api/services')).body.storage.connected, true);
  const created = await hit('/api/player', { method: 'POST', body: {} });
  assert.equal(created.status, 201);
  const credential = created.body.credential;
  assert.match(credential, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(playerRow.credential_hash, hashCredential(credential));
  assert.equal(created.body.player.credential_hash, undefined);
  assert.equal((await hit('/api/player', { credential })).body.player.id, created.body.player.id);
  assert.equal((await hit('/api/player', { credential: 'b'.repeat(43) })).status, 401);
  const forged = await hit('/api/runs', { method: 'POST', credential, body: { plan: sample, score: 999 } });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.error, 'UNEXPECTED_FIELD');
  assert.equal(calls.filter(call => call.path === 'rpc/akim_save_run').length, 0);
  const saved = await hit('/api/runs', { method: 'POST', credential, body: { plan: sample } });
  assert.equal(saved.status, 201);
  const expected = calculatePlan(sample);
  assert.equal(saved.body.run.score, expected.score);
  assert.deepEqual(savedPayload.p_result, expected);
  assert.equal(savedPayload.p_rules_version, RULES_VERSION);
  assert.equal(savedPayload.p_plan_hash, hashCredential(`${RULES_VERSION}:${JSON.stringify(expected.plan)}`));
  assert.equal(saved.body.rank, 1);
  const own = await hit('/api/runs', { credential });
  assert.equal(own.body.runs.length, 1);
  assert.deepEqual(own.body.runs[0].plan, expected.plan);
  const board = await hit('/api/leaderboard');
  assert.equal(board.body.entries[0].score, expected.score);
  assert.equal(JSON.stringify(board.body).includes(credential), false);
  assert.equal(JSON.stringify(board.body).includes(playerRow.credential_hash), false);
});

test('database failures stay explicit and cannot leak upstream error text', async t => {
  configure(t);
  const upstream = t.mock.method(globalThis, 'fetch', async () => ({ ok: false,
    json: async () => ({ code: 'PGRST205', message: 'private upstream diagnostic' }),
  }));
  const hit = await serverFor(t);
  const services = await hit('/api/services');
  assert.deepEqual(services.body.storage, { configured: true, connected: false, error: 'STORAGE_SCHEMA_REQUIRED' });
  assert.deepEqual((await hit('/api/leaderboard')).body, { error: 'STORAGE_SCHEMA_REQUIRED' });
  upstream.mock.mockImplementation(async () => { throw new Error('private upstream diagnostic'); });
  assert.deepEqual((await hit('/api/leaderboard')).body, { error: 'STORAGE_UNAVAILABLE' });
});
