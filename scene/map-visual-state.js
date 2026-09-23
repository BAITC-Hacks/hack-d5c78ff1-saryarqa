import { REGIONS, regionIdForDistrict } from '../game/contracts.js';

const scoredRegions = new Set(REGIONS.filter((region) => region.simulationDistrict).map((region) => region.regionId));
const knownRegions = new Set(REGIONS.map((region) => region.regionId));
const indicators = new Set(['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2']);
const phases = new Set(['queued', 'construction', 'active']);
const list = (value) => Array.isArray(value) ? value : [];
const isMeasure = (id) => typeof id === 'string' && /^M(?:[1-9]|1[0-4])$/.test(id);

function addEffects(target, effects) {
  for (const [indicator, delta] of Object.entries(effects ?? {})) {
    if (indicators.has(indicator) && Number.isFinite(delta) && delta !== 0) {
      target[indicator] = (target[indicator] ?? 0) + delta;
      if (target[indicator] === 0) delete target[indicator];
    }
  }
}

/**
 * Pure rendering adapter; never computes scores or intermediate engine outcomes.
 * Returns { mode: 'baseline'|'preview'|'result', regions: [{ regionId,
 *   effects: { [indicator]: suppliedDelta },
 *   measures: [{ id: measureId, phase: 'preview'|'queued'|'construction'|'active', progress: 0..1 }]
 * }] }. Region order follows regionIds (defaults to the six contract regions).
 * Preview phase has progress 1 so renderers can show its hypothetical appearance;
 * mode='preview' MUST be visibly identified as a draft, never a confirmed result.
 * During playback, effects combine only active cues, without lag/score calculation.
 * On completion, final reactions replace those cues, preserving synergy/clipping.
 * Empty/invalid/stale input yields empty baseline regions; reference regions never
 * receive effects. Every invocation creates fresh descriptors, clearing old edits.
 */
export function deriveMapVisualState({ snapshot, effectState, regionIds = REGIONS.map((region) => region.regionId) } = {}) {
  const regions = [...new Set(list(regionIds))].filter((id) => knownRegions.has(id))
    .map((regionId) => ({ regionId, effects: {}, measures: [] }));
  const byRegion = new Map(regions.filter((region) => scoredRegions.has(region.regionId))
    .map((region) => [region.regionId, region]));
  const baseline = { mode: 'baseline', regions };
  if (!snapshot) return baseline;

  const presentation = snapshot.presentation;
  const confirmed = snapshot.contractVersion === 1 && snapshot.result?.valid === true
    && presentation && Number.isSafeInteger(snapshot.planRevision) && snapshot.planRevision >= 0
    && presentation?.planRevision === snapshot.planRevision;
  if (!confirmed) {
    // A stale result is not permission to render its effects as a fresh draft.
    if (snapshot.result != null || list(snapshot.preview?.measures).length > 5 || list(snapshot.preview?.issues)
      .some((issue) => issue?.code !== 'EXACTLY_FIVE_REQUIRED')) return baseline;
    const seen = new Set();
    for (const measure of list(snapshot.preview?.measures)) {
      if (!isMeasure(measure?.id) || seen.has(measure.id)) continue;
      seen.add(measure.id);
      // Targets are supplied by previewPlan, including all five city districts.
      const targets = [...new Set(list(measure.targets).map(regionIdForDistrict))]
        .filter((id) => scoredRegions.has(id));
      if (measure.scope !== 'city' && (measure.scope !== 'district' || targets.length !== 1)) continue;
      for (const regionId of targets) {
        const region = byRegion.get(regionId);
        if (!region) continue;
        region.measures.push({ id: measure.id, phase: 'preview', progress: 1 });
        addEffects(region.effects, measure.effects);
      }
    }
    return { mode: regions.some((region) => region.measures.length) ? 'preview' : 'baseline', regions };
  }

  // A previous run's controller frame must not leak into a replay.
  if (effectState && snapshot.playback?.runId !== undefined
    && effectState.runId !== snapshot.playback.runId) return baseline;
  const status = effectState?.status ?? snapshot.playback?.status;
  const complete = status === 'complete';
  const cues = new Map();
  for (const cue of list(presentation.cues)) {
    if (isMeasure(cue?.measureId) && !cues.has(cue.measureId)) cues.set(cue.measureId, cue);
  }
  const markers = complete
    ? [...cues.values()].flatMap((cue) => list(cue.regionIds).map((regionId) => ({
      measureId: cue.measureId, regionId, phase: 'active', progress: 1,
    })))
    : list(effectState?.markers);
  const seen = new Set();
  for (const marker of markers) {
    const cue = cues.get(marker?.measureId);
    const region = byRegion.get(marker?.regionId);
    const key = `${marker?.measureId}:${marker?.regionId}`;
    if (!region || !cue || !list(cue.regionIds).includes(marker.regionId)
      || !phases.has(marker.phase) || seen.has(key)) continue;
    seen.add(key);
    const progress = Number.isFinite(marker.progress) ? Math.max(0, Math.min(1, marker.progress)) : 0;
    region.measures.push({ id: marker.measureId, phase: marker.phase, progress });
    if (!complete && marker.phase === 'active') addEffects(region.effects, cue.effects);
  }
  if (complete) {
    const seenReactions = new Set();
    for (const reaction of list(presentation.reactions)) {
      const region = byRegion.get(reaction?.regionId);
      const key = `${reaction?.regionId}:${reaction?.indicator}`;
      if (!region || !indicators.has(reaction.indicator) || !Number.isFinite(reaction.delta)
        || seenReactions.has(key)) continue;
      seenReactions.add(key);
      if (reaction.delta !== 0) region.effects[reaction.indicator] = reaction.delta;
    }
  }
  return { mode: 'result', regions };
}
