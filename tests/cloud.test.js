import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan } from '../simulator.js';
import { createCloudSession } from '../game/cloud.js';

const sample = [
  { id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
const alternative = sample.map(choice => choice.id === 'M7' ? { ...choice, district: 'Есиль' } : choice);
const result = calculatePlan(sample);
const otherResult = calculatePlan(alternative);
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => structuredClone(body) });
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('Cloud controller did not reach the expected asynchronous state.');
}
function fakeSession(initial = null) {
  let snapshot = { result: initial, planRevision: 0 };
  const listeners = new Set();
  return {
    getSnapshot: () => structuredClone(snapshot),
    subscribe(listener) { listeners.add(listener); listener(structuredClone(snapshot)); return () => listeners.delete(listener); },
    dispatch(action) { return action; },
    set(next, revision = snapshot.planRevision + 1) {
      snapshot = { result: next, planRevision: revision };
      for (const listener of listeners) listener(structuredClone(snapshot));
    },
  };
}
function fixture(t, { initial = null, storage = memory(), override } = {}) {
  const session = fakeSession(initial);
  const calls = [], storedRuns = [];
  const player = { id: 'fixture-player', name: 'Тестовый игрок' };
  const board = { entries: [{ playerId: player.id, rank: 1, score: result.score }], updatedAt: '2026-09-23T10:00:00.000Z' };
  const fetchImpl = async (path, options) => {
    calls.push({ path, options });
    const intercepted = override?.(path, options, calls);
    if (intercepted !== undefined) return intercepted;
    if (path === '/api/services') return response({ storage: { connected: true, configured: true } });
    if (path === '/api/leaderboard') return response(board);
    if (path === '/api/player') return response({ player, credential: 'fixture-only-anonymous-credential' });
    if (path === '/api/runs' && options.method === 'POST') {
      const calculated = calculatePlan(JSON.parse(options.body).plan);
      const run = { id: `run-${storedRuns.length}`, plan: calculated.plan, score: calculated.score };
      storedRuns.push(run);
      return response({ run, rank: 1 });
    }
    if (path === '/api/runs') return response({ player, rank: 1, runs: storedRuns });
    if (path === '/api/analyze') return response({ source: 'openai', score: result.score, analysis: 'Социальная инфраструктура улучшается.' });
    throw new Error(`Unexpected fixture request: ${path}`);
  };
  const cloud = createCloudSession({ session, storage, fetchImpl, documentRef: null, intervalMs: 60000 });
  t.after(() => cloud.destroy());
  return { cloud, session, storage, calls, board, storedRuns };
}

test('cloud saves only the plan and verifies the authoritative returned score', async t => {
  let forged = true;
  const { cloud, calls } = fixture(t, { initial: result, override(path, options) {
    if (path === '/api/runs' && options.method === 'POST' && forged) return response({ run: { score: 999 }, rank: 1 });
  } });
  await cloud.connect();
  assert.equal(cloud.getSnapshot().saveStatus, 'error');
  forged = false;
  await cloud.saveResult();
  assert.equal(cloud.getSnapshot().saveStatus, 'saved');
  const writes = calls.filter(call => call.path === '/api/runs' && call.options.method === 'POST');
  assert.equal(writes.length, 2);
  for (const { options } of writes) {
    assert.deepEqual(JSON.parse(options.body), { plan: result.plan });
    assert.equal(options.headers.Authorization, 'Bearer fixture-only-anonymous-credential');
  }
  await cloud.saveResult();
  assert.equal(calls.filter(call => call.path === '/api/runs' && call.options.method === 'POST').length, 2);
});

test('cloud rejects mismatched AI scores, untrusted sources and empty text', async t => {
  for (const invalid of [
    { source: 'openai', score: 999, analysis: 'Неверный результат.' },
    { source: 'local', score: result.score, analysis: 'Локальный текст.' },
    { source: 'openai', score: result.score, analysis: '  ' },
    { source: 'openai', score: null, analysis: 'Нет результата.' },
  ]) {
    const { cloud } = fixture(t, { initial: result, override: path => path === '/api/analyze' ? response(invalid) : undefined });
    await cloud.analyze();
    assert.equal(cloud.getSnapshot().ai.status, 'error');
    assert.equal(cloud.getSnapshot().ai.text, '');
  }
  const { cloud } = fixture(t, { initial: result });
  await cloud.analyze();
  assert.equal(cloud.getSnapshot().ai.status, 'complete');
  assert.equal(cloud.getSnapshot().ai.text, 'Социальная инфраструктура улучшается.');
});

test('editing a plan aborts AI and ignores an upstream response that arrives after abort', async t => {
  const pending = deferred();
  let signal;
  const { cloud, session } = fixture(t, { initial: result, override(path, options) {
    if (path === '/api/analyze') { signal = options.signal; return pending.promise; }
  } });
  const analyzing = cloud.analyze();
  assert.equal(cloud.getSnapshot().ai.status, 'loading');
  session.set(null);
  assert.equal(signal.aborted, true);
  pending.resolve(response({ source: 'openai', score: result.score, analysis: 'Устаревший ответ.' }));
  await analyzing;
  assert.equal(cloud.getSnapshot().ai.status, 'idle');
  assert.equal(cloud.getSnapshot().ai.text, '');
});

test('anonymous player identity survives reload and is reused for authenticated history', async t => {
  const first = fixture(t, { initial: result });
  await first.cloud.connect();
  const identity = JSON.parse([...first.storage.values.values()][0]);
  assert.equal(identity.credential, 'fixture-only-anonymous-credential');
  first.cloud.destroy();
  const second = fixture(t, { initial: otherResult, storage: first.storage });
  await second.cloud.connect();
  assert.equal(second.calls.filter(call => call.path === '/api/player').length, 0);
  assert.equal(second.cloud.getSnapshot().player.id, identity.player.id);
  for (const call of second.calls.filter(call => call.path === '/api/runs')) {
    assert.equal(call.options.headers.Authorization, `Bearer ${identity.credential}`);
  }
});

test('incomplete and invalid plans never create a player, save or request AI', async t => {
  for (const initial of [null, calculatePlan(sample.slice(0, 4))]) {
    const { cloud, calls } = fixture(t, { initial });
    await cloud.connect();
    await cloud.saveResult();
    await cloud.analyze();
    assert.equal(calls.filter(call => call.path === '/api/player' || call.options.method === 'POST').length, 0);
    assert.equal(cloud.getSnapshot().saveStatus, 'idle');
  }
});

test('offline refresh preserves last leaderboard and history rather than inventing empty results', async t => {
  let offline = false;
  const { cloud } = fixture(t, { initial: result, override(path) {
    if (offline && path === '/api/services') throw new Error('fixture offline');
  } });
  await cloud.connect();
  const last = cloud.getSnapshot();
  assert.equal(last.connection, 'connected');
  assert.ok(last.entries.length);
  assert.ok(last.history.length);
  offline = true;
  await cloud.refresh();
  const current = cloud.getSnapshot();
  assert.equal(current.connection, 'offline');
  assert.deepEqual(current.entries, last.entries);
  assert.deepEqual(current.history, last.history);
  assert.equal(current.updatedAt, last.updatedAt);
});

test('a second finalized plan is saved after the first pending save completes', async t => {
  const pending = deferred();
  let writes = 0;
  const { cloud, session, calls } = fixture(t, { override(path, options) {
    if (path === '/api/runs' && options.method === 'POST' && ++writes === 1) return pending.promise;
  } });
  await cloud.connect();
  session.set(result);
  await until(() => writes === 1);
  session.set(otherResult);
  pending.resolve(response({ run: { score: result.score }, rank: 1 }));
  await until(() => writes === 2 && cloud.getSnapshot().saveStatus === 'saved');
  const plans = calls.filter(call => call.path === '/api/runs' && call.options.method === 'POST').map(call => JSON.parse(call.options.body).plan);
  assert.deepEqual(plans, [result.plan, otherResult.plan]);
});

test('failure of an older pending save does not drop a newer finalized plan', async t => {
  const pending = deferred();
  let writes = 0;
  const { cloud, session, calls } = fixture(t, { override(path, options) {
    if (path === '/api/runs' && options.method === 'POST' && ++writes === 1) return pending.promise;
  } });
  await cloud.connect();
  session.set(result);
  await until(() => writes === 1);
  session.set(otherResult);
  pending.reject(new Error('fixture first save failed'));
  await until(() => writes === 2 && cloud.getSnapshot().saveStatus === 'saved');
  const plans = calls.filter(call => call.path === '/api/runs' && call.options.method === 'POST').map(call => JSON.parse(call.options.body).plan);
  assert.deepEqual(plans, [result.plan, otherResult.plan]);
});
