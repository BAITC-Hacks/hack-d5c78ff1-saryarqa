import { DISTRICTS, MEASURES, realizedMeasureEffects, validatePlan } from '../simulator.js';

const measuresById = new Map(MEASURES.map((measure) => [measure.id, measure]));
const districtNames = new Set(DISTRICTS.map((district) => district.name));
const cityTargets = DISTRICTS.map((district) => district.name);

/** Policy facts for an editable draft. A draft is never assigned a city score. */
export function previewPlan(plan) {
  const validation = validatePlan(plan);
  if (!Array.isArray(plan)) return { measures: [], issues: validation.errors, score: null };
  const issues = validation.errors.filter((issue) => issue.code !== 'EXACTLY_FIVE_REQUIRED');

  const seen = new Set();
  const measures = [];
  for (const choice of plan) {
    const measure = measuresById.get(choice?.id);
    if (!measure || seen.has(measure.id)) continue;
    seen.add(measure.id);
    const { factor, effects } = realizedMeasureEffects(measure);
    const targets = measure.scope === 'city'
      ? [...cityTargets]
      : districtNames.has(choice.district) ? [choice.district] : [];
    measures.push({
      id: measure.id,
      scope: measure.scope,
      targets,
      cost: measure.cost,
      lag: measure.lag,
      factor,
      effects,
    });
  }
  return { measures, issues, score: null };
}
