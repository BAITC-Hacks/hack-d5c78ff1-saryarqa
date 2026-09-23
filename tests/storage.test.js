import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES_VERSION } from '../simulator.js';
import { BEST_STORAGE_KEY, loadPersonalBest, savePersonalBest } from '../game/storage.js';

const sample = [
  { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
};

test('saved personal best stores only plan and version, then recomputes score', () => {
  const storage = memory();
  assert.equal(savePersonalBest(storage, sample), true);
  const record = JSON.parse(storage.getItem(BEST_STORAGE_KEY));
  assert.deepEqual(Object.keys(record).sort(), ['plan', 'rulesVersion']);
  assert.equal(record.rulesVersion, RULES_VERSION);
  const loaded = loadPersonalBest(storage);
  assert.ok(Math.abs(loaded.score - 56.54307) < 1e-10);
  assert.equal(loaded.plan.length, 5);
});

test('corrupt, stale, invalid and forged scores are not trusted', () => {
  const storage = memory();
  storage.setItem(BEST_STORAGE_KEY, '{');
  assert.equal(loadPersonalBest(storage), null);
  storage.setItem(BEST_STORAGE_KEY, JSON.stringify({ rulesVersion: 'old', plan: sample }));
  assert.equal(loadPersonalBest(storage), null);
  storage.setItem(BEST_STORAGE_KEY, JSON.stringify({ rulesVersion: RULES_VERSION, plan: sample.slice(0, 4) }));
  assert.equal(loadPersonalBest(storage), null);
  storage.setItem(BEST_STORAGE_KEY, JSON.stringify({ rulesVersion: RULES_VERSION, plan: sample, score: 999 }));
  assert.ok(Math.abs(loadPersonalBest(storage).score - 56.54307) < 1e-10);
});

test('storage failures and invalid save do not crash', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert.equal(loadPersonalBest(storage), null);
  assert.equal(savePersonalBest(storage, sample), false);
  assert.equal(savePersonalBest(memory(), sample.slice(0, 4)), false);
});
