import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.js';
import { calculatePlan } from '../simulator.js';

test('local accounts authenticate by secret code, persist hashed access, rename and save authoritative deduplicated history', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'akim-accounts-'));
  const previous = { mode: process.env.AKIM_STORAGE_MODE, directory: process.env.AKIM_DATA_DIR };
  process.env.AKIM_STORAGE_MODE = 'local'; process.env.AKIM_DATA_DIR = directory;
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previous.mode === undefined) delete process.env.AKIM_STORAGE_MODE; else process.env.AKIM_STORAGE_MODE = previous.mode;
    if (previous.directory === undefined) delete process.env.AKIM_DATA_DIR; else process.env.AKIM_DATA_DIR = previous.directory;
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function hit(path, body, credential) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await hit('/api/services')).data.storage.mode, 'local');
  assert.equal((await hit('/api/player', { displayName: '<bad>' })).status, 400);
  const created = await hit('/api/player', { displayName: 'Тестовый аким' });
  assert.equal(created.status, 201); const { player, credential } = created.data;
  assert.equal(credential.length, 43);
  assert.equal((await hit('/api/player', undefined, credential)).data.player.id, player.id);
  assert.equal((await hit('/api/player', undefined, 'x'.repeat(43))).status, 401);
  assert.equal((await hit('/api/player', { action: 'rename', displayName: 'Новый аким' }, credential)).data.player.displayName, 'Новый аким');
  const plan = [{ id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' }, { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M5', district: 'Сарыарка' }];
  assert.equal((await hit('/api/runs', { plan, score: 99 }, credential)).status, 400);
  assert.equal((await hit('/api/runs', { plan: [] }, credential)).status, 422);
  const saved = await hit('/api/runs', { plan }, credential);
  assert.equal(saved.data.run.score, calculatePlan(plan).score);
  assert.equal((await hit('/api/runs', { plan }, credential)).data.run.id, saved.data.run.id);
  assert.equal((await hit('/api/runs', undefined, credential)).data.runs.length, 1);
  const board = await hit('/api/leaderboard');
  assert.equal(board.data.entries[0].displayName, 'Новый аким');
  assert.equal(board.data.entries[0].rank, 1);
  const raw = await readFile(join(directory, 'players.json'), 'utf8');
  assert.equal(raw.includes(credential), false); assert.ok(raw.includes('credential_hash'));
});
