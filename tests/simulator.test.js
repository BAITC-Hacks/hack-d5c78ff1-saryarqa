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
