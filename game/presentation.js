import { INDICATORS, SIMULATION_HORIZON } from '../simulator.js';
import { regionIdForDistrict } from './contracts.js';

/** Scene metadata from a confirmed engine result. No timing or scoring occurs here. */
export function createPresentation(result, draft, planRevision) {
  if (result?.valid !== true || !Array.isArray(result.plan) || !Array.isArray(result.measureEffects)
    || !Array.isArray(result.districts) || !Array.isArray(draft)
    || !Number.isSafeInteger(planRevision) || planRevision < 0) return null;

  // Do not animate a stale result against a newer or different draft.
  const confirmed = new Map(result.plan.map((choice) => [choice.id, choice.district ?? null]));
  if (confirmed.size !== result.plan.length || draft.length !== result.plan.length) return null;
  const seen = new Set();
  for (const choice of draft) {
    if (!choice || seen.has(choice.id) || !confirmed.has(choice.id)
      || (choice.district ?? null) !== confirmed.get(choice.id)) return null;
    seen.add(choice.id);
  }

  const effectsById = new Map(result.measureEffects.map((item) => [item.id, item]));
  if (effectsById.size !== result.measureEffects.length || effectsById.size !== draft.length) return null;
  const cues = draft.map((choice) => {
    const item = effectsById.get(choice.id);
    if (!item || !Array.isArray(item.targets)) return null;
    const regionIds = item.targets.map(regionIdForDistrict);
    if (regionIds.some((id) => id === null)) return null;
    return {
      measureId: choice.id,
      regionIds,
      lag: item.lag,
      effects: { ...item.effects },
    };
  });
  if (cues.some((cue) => cue === null)) return null;

  const reactions = [];
  for (const district of result.districts) {
    const regionId = regionIdForDistrict(district.name);
    if (!regionId || !district.before || !district.after) return null;
    for (const { id: indicator } of INDICATORS) {
      const before = district.before[indicator];
      const after = district.after[indicator];
      if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
      const delta = after - before;
      reactions.push({ regionId, indicator, delta, tone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral' });
    }
  }

  return {
    planRevision,
    horizon: SIMULATION_HORIZON,
    order: draft.map((choice) => choice.id),
    cues,
    reactions,
  };
}
