import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan } from '../simulator.js';
import { createPresentation } from '../game/presentation.js';

const official = [
  { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];

test('presentation preserves draft turn order and engine-derived effect cues', () => {
  const result = calculatePlan(official);
  const presentation = createPresentation(result, official, 3);
  assert.equal(presentation.planRevision, 3);
  assert.equal(presentation.horizon, 8);
  assert.deepEqual(presentation.order, ['M7', 'M8', 'M10', 'M12', 'M5']);
  assert.deepEqual(presentation.cues.map((cue) => cue.measureId), presentation.order);
  assert.deepEqual(presentation.cues.find((cue) => cue.measureId === 'M12').regionIds,
    ['esil', 'almaty', 'saryarka', 'baikonur', 'nura']);
  assert.deepEqual(presentation.cues.find((cue) => cue.measureId === 'M7'),
    { measureId: 'M7', regionIds: ['nura'], lag: 3, effects: { S1: 10 } });
  assert.equal(presentation.reactions.length, 50);
  assert.ok(!presentation.reactions.some((reaction) => reaction.regionId === 'saraishyk'));
  assert.deepEqual(presentation.reactions.find((reaction) => reaction.regionId === 'nura' && reaction.indicator === 'S1'),
    { regionId: 'nura', indicator: 'S1', delta: 10, tone: 'positive' });
  assert.deepEqual(presentation.reactions.find((reaction) => reaction.regionId === 'esil' && reaction.indicator === 'S1'),
    { regionId: 'esil', indicator: 'S1', delta: 0, tone: 'neutral' });
});

test('negative and mixed indicator deltas do not become universal cheering', () => {
  const draft = [
    { id: 'M11', district: 'Нура' }, { id: 'M7', district: 'Нура' },
    { id: 'M8', district: 'Нура' }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ];
  const presentation = createPresentation(calculatePlan(draft), draft, 1);
  assert.deepEqual(presentation.reactions.find((reaction) => reaction.regionId === 'nura' && reaction.indicator === 'T1'),
    { regionId: 'nura', indicator: 'T1', delta: -1.75, tone: 'negative' });
  assert.ok(presentation.reactions.some((reaction) => reaction.tone === 'positive'));
  assert.ok(presentation.reactions.some((reaction) => reaction.tone === 'neutral'));
});

test('invalid or stale result never produces presentation metadata', () => {
  assert.equal(createPresentation(calculatePlan(official.slice(1)), official.slice(1), 1), null);
  assert.equal(createPresentation(calculatePlan(official), official.slice(1), 1), null);
  assert.equal(createPresentation(calculatePlan(official), official.map((choice) => choice.id === 'M7' ? { ...choice, district: 'Есиль' } : choice), 1), null);
  assert.equal(createPresentation(calculatePlan(official), official, -1), null);
});
