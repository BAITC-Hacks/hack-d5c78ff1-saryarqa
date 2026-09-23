import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, DISTRICTS, calculatePlan, validatePlan } from '../simulator.js';

const example = [
  { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
const codes = (plan) => validatePlan(plan).errors.map((item) => item.code);

test('official baseline has exact score and exactly two critical cells', () => {
  assert.ok(Math.abs(BASELINE.score - 52.55768) < 1e-10);
  assert.ok(Math.abs(BASELINE.cityAverage - 56.8624) < 1e-10);
  assert.deepEqual(BASELINE.criticalCells, [
    { district: 'Нура', indicator: 'S1', value: 38 },
    { district: 'Нура', indicator: 'S2', value: 35 },
  ]);
  assert.equal(BASELINE.districts.find((district) => district.name === 'Сарыарка').before.E2, 40);
  assert.ok(!BASELINE.criticalCells.some((cell) => cell.value === 40));
});

test('official example reproduces cost, synergy, districts and score', () => {
  const result = calculatePlan(example);
  assert.equal(result.valid, true);
  assert.equal(result.cost, 95);
  assert.equal(result.remaining, 5);
  assert.ok(Math.abs(result.score - 56.54307) < 1e-10);
  assert.ok(Math.abs(result.cityAverage - 58.0776) < 1e-10);
  assert.equal(result.criticalCount, 0);
  assert.deepEqual(result.synergies, [{ measures: ['M10', 'M12'], district: 'Нура', indicator: 'B1', amount: 2 }]);
  [63.4275, 57.4975, 56.3, 57.0675, 52.9625].forEach((expected, index) => {
    assert.ok(Math.abs(result.districts[index].scoreAfter - expected) < 1e-10);
  });
});

test('selection order does not change output', () => {
  assert.deepEqual(calculatePlan(example), calculatePlan([...example].reverse()));
});

test('invalid plans never have a score', () => {
  for (const plan of [[], [example[0]], [...example, example[0]]]) {
    assert.equal(calculatePlan(plan).score, null);
  }
  assert.ok(codes([...example, example[0]]).includes('DUPLICATE_MEASURE'));
});

test('budget and direction limits are enforced', () => {
  const overBudget = [
    { id: 'M2', district: null }, { id: 'M3', district: 'Нура' },
    { id: 'M5', district: 'Сарыарка' }, { id: 'M7', district: 'Нура' },
    { id: 'M14', district: null },
  ];
  assert.ok(codes(overBudget).includes('BUDGET_EXCEEDED'));
  const tooManySocial = [
    { id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
    { id: 'M9', district: 'Нура' }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ];
  assert.ok(codes(tooManySocial).includes('DIRECTION_LIMIT_EXCEEDED'));
});

test('global and same-district incompatibilities are enforced', () => {
  const oneAndThree = [
    { id: 'M1', district: 'Есиль' }, { id: 'M3', district: 'Нура' },
    { id: 'M8', district: 'Нура' }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ];
  assert.ok(codes(oneAndThree).includes('INCOMPATIBLE_GLOBAL_PAIR'));
  const fourAndSeven = [
    { id: 'M4', district: 'Нура' }, { id: 'M7', district: 'Нура' },
    { id: 'M2', district: null }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ];
  assert.ok(codes(fourAndSeven).includes('INCOMPATIBLE_DISTRICT_PAIR'));
  fourAndSeven[0].district = 'Есиль';
  assert.ok(!codes(fourAndSeven).includes('INCOMPATIBLE_DISTRICT_PAIR'));
  const fiveAndThirteen = [
    { id: 'M5', district: 'Сарыарка' }, { id: 'M13', district: 'Сарыарка' },
    { id: 'M9', district: 'Нура' }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ];
  assert.ok(codes(fiveAndThirteen).includes('INCOMPATIBLE_DISTRICT_PAIR'));
});

test('district assignment and unknown IDs are checked', () => {
  assert.ok(codes(example.map((choice) => choice.id === 'M7' ? { id: 'M7' } : choice)).includes('DISTRICT_REQUIRED'));
  assert.ok(codes(example.map((choice) => choice.id === 'M12' ? { id: 'M12', district: 'Нура' } : choice)).includes('DISTRICT_FORBIDDEN'));
  assert.ok(codes(example.map((choice) => choice.id === 'M7' ? { id: 'M7', district: 'Неизвестный' } : choice)).includes('UNKNOWN_DISTRICT'));
  assert.ok(codes(example.map((choice) => choice.id === 'M7' ? { id: 'M99', district: 'Нура' } : choice)).includes('UNKNOWN_MEASURE'));
});

test('city effects reach all districts, values remain in range', () => {
  const result = calculatePlan(example);
  for (const district of result.districts) {
    assert.ok(district.after.C2 > district.before.C2);
    for (const value of Object.values(district.after)) assert.ok(value >= 0 && value <= 100);
  }
  assert.equal(result.districts.length, DISTRICTS.length);
});

test('all three synergy bonuses stay fixed and apply only in the paired district', () => {
  const transport = calculatePlan([
    { id: 'M1', district: 'Нура' }, { id: 'M2', district: null },
    { id: 'M4', district: 'Сарыарка' }, { id: 'M9', district: 'Нура' },
    { id: 'M14', district: null },
  ]);
  assert.equal(transport.valid, true);
  assert.deepEqual(transport.synergies, [
    { measures: ['M1', 'M2'], district: 'Нура', indicator: 'T1', amount: 2 },
  ]);
  assert.equal(transport.districts.find((district) => district.name === 'Нура').after.T1, 64.5);
  assert.equal(transport.districts.find((district) => district.name === 'Есиль').after.T1, 48);

  const ecology = calculatePlan([
    { id: 'M5', district: 'Сарыарка' }, { id: 'M6', district: null },
    { id: 'M8', district: 'Нура' }, { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
  ]);
  assert.equal(ecology.valid, true);
  assert.deepEqual(ecology.synergies, [
    { measures: ['M5', 'M6'], district: 'Сарыарка', indicator: 'E2', amount: 2 },
    { measures: ['M10', 'M12'], district: 'Нура', indicator: 'B1', amount: 2 },
  ]);
  assert.equal(ecology.districts.find((district) => district.name === 'Сарыарка').after.E2, 52.25);
  assert.equal(ecology.districts.find((district) => district.name === 'Есиль').after.E2, 73.5);
  assert.equal(ecology.districts.find((district) => district.name === 'Нура').after.B1, 67.5);
});

test('exactly 100 budget is valid and unspent funds never enter the formula', () => {
  const result = calculatePlan([
    { id: 'M3', district: 'Нура' }, { id: 'M7', district: 'Нура' },
    { id: 'M8', district: 'Нура' }, { id: 'M11', district: 'Алматы' },
    { id: 'M14', district: null },
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.cost, 100);
  assert.equal(result.remaining, 0);
  const official = calculatePlan(example);
  for (const plan of [result, official]) {
    assert.equal(plan.score, 0.7 * plan.cityAverage + 0.3 * plan.weakestDistrict.score - plan.criticalCount);
  }
});

test('official cheapest plan preserves adverse traffic effects and new critical cells', () => {
  const result = calculatePlan([
    { id: 'M9', district: 'Нура' }, { id: 'M11', district: 'Алматы' },
    { id: 'M10', district: 'Нура' }, { id: 'M12', district: null },
    { id: 'M4', district: 'Сарыарка' },
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.cost, 61);
  assert.equal(result.districts.find((district) => district.name === 'Алматы').after.T1, 38.25);
  assert.deepEqual(result.criticalCells, [
    { district: 'Алматы', indicator: 'T1', value: 38.25 },
    { district: 'Нура', indicator: 'S2', value: 37.625 },
  ]);
});

test('changing an assignment changes the score without mutating the submitted plan', () => {
  const original = structuredClone(example);
  const changed = example.map((choice) => choice.id === 'M7' ? { ...choice, district: 'Есиль' } : choice);
  const first = calculatePlan(example);
  const second = calculatePlan(changed);
  assert.equal(first.valid, true);
  assert.equal(second.valid, true);
  assert.notEqual(first.score, second.score);
  assert.deepEqual(example, original);
  assert.equal(second.criticalCount, 1);
});

test('malformed input and a duplicate in different districts have no score or effects', () => {
  const duplicate = [...example.slice(0, 4), { id: 'M7', district: 'Есиль' }];
  for (const input of [null, {}, 'M7', [null, ...example.slice(1)], duplicate]) {
    const result = calculatePlan(input);
    assert.equal(result.valid, false);
    assert.equal(result.score, null);
    assert.equal(result.delta, null);
    assert.equal(result.districts, undefined);
    assert.ok(result.errors.length > 0);
  }
  assert.ok(codes(duplicate).includes('DUPLICATE_MEASURE'));
});
