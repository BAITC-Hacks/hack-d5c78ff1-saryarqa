import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES_VERSION } from '../simulator.js';
import { BEST_STORAGE_KEY, DRAFT_STORAGE_KEY, VIEW_STORAGE_KEY, loadPersonalBest, savePersonalBest, loadDraft, saveDraft, loadViewPreferences, saveViewPreferences } from '../game/storage.js';

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

test('draft recovery preserves incomplete assignments and conflicts without storing computed state', () => {
  const storage = memory();
  const draft = [{ id: 'M1', district: '' }, { id: 'M3', district: 'Нура', score: 999 }];
  assert.equal(saveDraft(storage, draft), true);
  const record = JSON.parse(storage.getItem(DRAFT_STORAGE_KEY));
  assert.deepEqual(Object.keys(record).sort(), ['plan', 'rulesVersion', 'schemaVersion']);
  assert.equal(record.schemaVersion, 1);
  assert.deepEqual(loadDraft(storage), [{ id: 'M1', district: null }, { id: 'M3', district: 'Нура' }]);
  assert.equal(saveDraft(storage, []), true);
  assert.deepEqual(loadDraft(storage), []);
});

test('invalid, stale, oversized and future-schema drafts are ignored; legacy drafts remain usable', () => {
  const storage = memory();
  const record = (plan) => ({ rulesVersion: RULES_VERSION, plan });
  const invalid = [
    '{', 'null', JSON.stringify([]),
    JSON.stringify({ ...record(sample), rulesVersion: 'old' }),
    JSON.stringify({ ...record(sample), schemaVersion: 2 }),
    JSON.stringify({ ...record(sample), filler: 'x'.repeat(16384) }),
    JSON.stringify(record([{ id: 'unknown' }])),
    JSON.stringify(record([{ id: 'M7', district: 'Сарайшық' }])),
    JSON.stringify(record([{ id: 'M12', district: 'Нура' }])),
    JSON.stringify(record([sample[0], sample[0]])),
    JSON.stringify(record([...sample, { id: 'M9', district: 'Нура' }])),
    JSON.stringify(record([{ id: 'M3', district: 'Нура' }, { id: 'M5', district: 'Нура' }, { id: 'M7', district: 'Нура' }, { id: 'M13', district: 'Нура' }])),
  ];
  for (const raw of invalid) {
    storage.setItem(DRAFT_STORAGE_KEY, raw);
    assert.deepEqual(loadDraft(storage), []);
  }
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record(sample)));
  assert.deepEqual(loadDraft(storage), sample);
  assert.equal(saveDraft(storage, [{ id: 'unknown' }]), false);
  assert.deepEqual(loadDraft(storage), sample, 'invalid save must preserve the last usable draft');
});

test('view preferences restore only recognized values and available district scenes', () => {
  const storage = memory();
  assert.deepEqual(loadViewPreferences(storage), { mode: 'game', projection: 'tilted', focusedRegion: null, view: 'overview' });
  const saved = { mode: 'calculator', projection: 'top', focusedRegion: 'nura', view: 'district' };
  assert.equal(saveViewPreferences(storage, saved), true);
  assert.deepEqual(loadViewPreferences(storage), saved);
  storage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ rulesVersion: RULES_VERSION, mode: 'invented', projection: 'invented', focusedRegion: 'esil', view: 'district', result: { score: 999 } }));
  assert.deepEqual(loadViewPreferences(storage), { mode: 'game', projection: 'tilted', focusedRegion: 'esil', view: 'overview' });
  storage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ rulesVersion: 'old', ...saved }));
  assert.deepEqual(loadViewPreferences(storage), { mode: 'game', projection: 'tilted', focusedRegion: null, view: 'overview' });
});

test('blocked or disabled storage never breaks draft and view actions', () => {
  for (const storage of [null, { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } }]) {
    assert.deepEqual(loadDraft(storage), []);
    assert.equal(saveDraft(storage, sample), false);
    assert.equal(saveViewPreferences(storage, { projection: 'top' }), false);
    assert.equal(loadViewPreferences(storage).projection, 'tilted');
  }
});
