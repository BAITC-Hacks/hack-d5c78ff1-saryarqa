import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan, INDICATORS } from '../simulator.js';
import { createForecast } from '../game/forecast.js';

const sample = [
  { id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M5', district: 'Сарыарка' },
];

test('forecast uses official full-horizon scores and exact before/after cells', () => {
  const result = calculatePlan(sample);
  const forecast = createForecast({ ...result, score: 999 });
  assert.ok(Math.abs(forecast.scoreAfter - 56.54307) < 1e-9);
  assert.equal(forecast.horizon, 8);
  assert.equal(forecast.scoreBefore, result.baseline);
  assert.equal(forecast.criticalBefore, 2);
  assert.equal(forecast.criticalAfter, 0);
  for (const change of forecast.changes) {
    const district = result.districts.find(item => item.name === change.district);
    assert.equal(change.before, district.before[change.indicator]);
    assert.equal(change.after, district.after[change.indicator]);
    assert.equal(change.delta, change.after - change.before);
    assert.equal(change.name, INDICATORS.find(item => item.id === change.indicator).name);
  }
  assert.equal(createForecast(calculatePlan([])), null);
  assert.equal(createForecast(null), null);
  assert.equal(createForecast({ valid: true, plan: [] }), null);
});

test('all suggestions are distinct valid single-decision alternatives with engine scores', () => {
  const result = calculatePlan(sample);
  const forecast = createForecast(result);
  assert.ok(forecast.suggestions.length > 0 && forecast.suggestions.length <= 3);
  assert.ok(forecast.search.evaluated <= 270);
  assert.equal(forecast.search.exhaustive, false);
  const keys = new Set();
  for (const suggestion of forecast.suggestions) {
    const candidate = calculatePlan(suggestion.plan);
    assert.equal(candidate.valid, true);
    assert.deepEqual(candidate, suggestion.result);
    assert.equal(suggestion.delta, candidate.score - result.score);
    assert.ok(suggestion.delta > 0);
    assert.ok(candidate.cost <= 100);
    assert.equal(suggestion.costDelta, candidate.cost - result.cost);
    assert.equal(result.plan.filter(choice => candidate.plan.some(other => JSON.stringify(other) === JSON.stringify(choice))).length, 4);
    keys.add(JSON.stringify(candidate.plan));
  }
  assert.equal(keys.size, forecast.suggestions.length);
  assert.deepEqual(createForecast(calculatePlan([...sample].reverse())), forecast);
});

test('reassignment is searched and residual critical cells and negative tradeoffs remain explicit', () => {
  const plan = [{ id: 'M7', district: 'Есиль' }, { id: 'M8', district: 'Есиль' },
    { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M11', district: 'Алматы' }];
  const forecast = createForecast(calculatePlan(plan));
  assert.ok(forecast.risks.some(cell => cell.criticalAfter && cell.district === 'Нура'));
  assert.ok(forecast.risks.some(cell => cell.indicator === 'T1' && cell.delta < 0));
  const misassigned = [{ id: 'M2' }, { id: 'M3', district: 'Нура' }, { id: 'M8', district: 'Есиль' }, { id: 'M9', district: 'Нура' }, { id: 'M14' }];
  const best = createForecast(calculatePlan(misassigned)).suggestions[0];
  assert.deepEqual(best.replaced, { id: 'M8', district: 'Есиль' });
  assert.deepEqual(best.replacement, { id: 'M8', district: 'Нура' });
});

test('known optimum returns no fabricated improvement', () => {
  const optimal = [{ id: 'M2' }, { id: 'M3', district: 'Нура' }, { id: 'M8', district: 'Нура' }, { id: 'M9', district: 'Нура' }, { id: 'M14' }];
  assert.deepEqual(createForecast(calculatePlan(optimal)).suggestions, []);
});
