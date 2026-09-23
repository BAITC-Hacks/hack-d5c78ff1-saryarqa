import { BASELINE, DISTRICTS, INDICATORS, MEASURES, SIMULATION_HORIZON, calculatePlan } from '../simulator.js';

const measures = new Map(MEASURES.map(measure => [measure.id, measure]));
const signature = plan => JSON.stringify(plan);
const describe = choice => `${measures.get(choice.id).name} — ${choice.district || 'весь город'}`;

/** Model outcome at the official horizon, never a real-world or quarterly prediction. */
export function createForecast(input) {
  if (!input?.valid || !Array.isArray(input.plan)) return null;
  // Recompute instead of trusting cached, modified or externally supplied scores.
  const result = calculatePlan(input.plan);
  if (!result.valid) return null;
  const cells = result.districts.flatMap(district => INDICATORS.map(indicator => ({
    district: district.name, indicator: indicator.id, name: indicator.name,
    before: district.before[indicator.id], after: district.after[indicator.id],
    delta: district.after[indicator.id] - district.before[indicator.id],
    criticalBefore: district.before[indicator.id] < 40,
    criticalAfter: district.after[indicator.id] < 40,
  })));
  const suggestions = [];
  const seen = new Set([signature(result.plan)]);
  let evaluated = 0;
  let valid = 0;
  for (let index = 0; index < result.plan.length; index += 1) {
    const replaced = result.plan[index];
    const retained = result.plan.filter((_, position) => position !== index);
    const retainedIds = new Set(retained.map(choice => choice.id));
    for (const measure of MEASURES) {
      if (retainedIds.has(measure.id)) continue;
      const targets = measure.scope === 'city' ? [null] : DISTRICTS.map(district => district.name);
      for (const district of targets) {
        const replacement = { id: measure.id, district };
        if (replacement.id === replaced.id && replacement.district === replaced.district) continue;
        evaluated += 1;
        const candidate = calculatePlan([...retained, replacement]);
        if (!candidate.valid) continue;
        const key = signature(candidate.plan);
        if (seen.has(key)) continue;
        seen.add(key);
        valid += 1;
        if (candidate.score <= result.score + 1e-10) continue;
        suggestions.push({
          label: `${describe(replaced)} → ${describe(replacement)}`,
          plan: candidate.plan, result: candidate, delta: candidate.score - result.score,
          costDelta: candidate.cost - result.cost, replaced, replacement,
        });
      }
    }
  }
  suggestions.sort((a, b) => b.delta - a.delta || a.result.cost - b.result.cost ||
    (signature(a.plan) < signature(b.plan) ? -1 : 1));
  return {
    horizon: SIMULATION_HORIZON,
    scoreBefore: BASELINE.score, scoreAfter: result.score, scoreDelta: result.delta,
    cost: result.cost, remaining: result.remaining,
    cityAverageBefore: BASELINE.cityAverage, cityAverageAfter: result.cityAverage,
    weakestDistrict: result.weakestDistrict,
    criticalBefore: BASELINE.criticalCount, criticalAfter: result.criticalCount,
    districts: result.districts.map(district => ({ name: district.name,
      before: district.scoreBefore, after: district.scoreAfter, delta: district.scoreDelta })),
    changes: cells.filter(cell => cell.delta !== 0),
    risks: cells.filter(cell => cell.criticalAfter || cell.delta < 0),
    suggestions: suggestions.slice(0, 3),
    search: { evaluated, valid, scope: 'one-change', exhaustive: false },
  };
}
