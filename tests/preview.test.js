import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, RULES_VERSION, calculatePlan, realizedMeasureEffects, MEASURES } from '../simulator.js';
import { previewPlan } from '../game/preview.js';

test('shared lag helper preserves official scoring vectors', () => {
  assert.equal(RULES_VERSION, 'hackalem-v1');
  assert.deepEqual(realizedMeasureEffects(MEASURES.find((measure) => measure.id === 'M11')),
    { factor: 0.875, effects: { B2: 10.5, T1: -1.75 } });
  assert.ok(Math.abs(BASELINE.score - 52.55768) < 1e-10);
  const official = [
    { id: 'M7', district: 'Нура' },
    { id: 'M8', district: 'Нура' },
    { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
    { id: 'M5', district: 'Сарыарка' },
  ];
  assert.ok(Math.abs(calculatePlan(official).score - 56.54307) < 1e-10);
});

test('partial preview contains realized effects and never a score', () => {
  const input = [{ id: 'M11', district: 'Нура' }, { id: 'M12', district: null }];
  const preview = previewPlan(input);
  assert.equal(preview.score, null);
  assert.deepEqual(preview.issues, []);
  assert.deepEqual(preview.measures[0], {
    id: 'M11', scope: 'district', targets: ['Нура'], cost: 10, lag: 1,
    factor: 0.875, effects: { B2: 10.5, T1: -1.75 },
  });
  assert.deepEqual(preview.measures[1].targets, ['Есиль', 'Алматы', 'Сарыарка', 'Байконур', 'Нура']);
  assert.deepEqual(preview.measures[1].effects, { C2: 4.375 });
  assert.deepEqual(input, [{ id: 'M11', district: 'Нура' }, { id: 'M12', district: null }]);
});

test('missing/unknown targets produce issues without invented placements or score', () => {
  const preview = previewPlan([
    { id: 'M7', district: null },
    { id: 'M8', district: 'Сарайшық' },
    { id: 'M12', district: 'Нура' },
    { id: 'M99', district: 'Нура' },
  ]);
  assert.equal(preview.score, null);
  assert.deepEqual(preview.measures.map((measure) => measure.targets), [[], [], ['Есиль', 'Алматы', 'Сарыарка', 'Байконур', 'Нура']]);
  assert.deepEqual(preview.issues.map((issue) => issue.code), ['DISTRICT_REQUIRED', 'UNKNOWN_DISTRICT', 'DISTRICT_FORBIDDEN', 'UNKNOWN_MEASURE']);
});

test('draft incompatibilities are visible while the score stays absent', () => {
  const preview = previewPlan([{ id: 'M1', district: 'Есиль' }, { id: 'M3', district: 'Нура' }]);
  assert.equal(preview.score, null);
  assert.ok(preview.issues.some((issue) => issue.code === 'INCOMPATIBLE_GLOBAL_PAIR'));
});

test('malformed plan remains unscored with a structural issue', () => {
  assert.deepEqual(previewPlan(null), {
    measures: [], issues: [{ code: 'EXACTLY_FIVE_REQUIRED', message: 'Выберите ровно 5 мероприятий.' }], score: null,
  });
});
