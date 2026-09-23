/** Presentation-only scheduling. All targets and outcomes come from contract v1. */
export const EFFECT_LIMITS = Object.freeze({
  maxMeasures: 5,
  maxMarkers: 25,
  maxReactions: 50,
  horizon: 8,
  secondsPerQuarter: 2,
  maxSpeed: 8,
});

const REGION_BY_DISTRICT = Object.freeze({
  Есиль: 'esil',
  Алматы: 'almaty',
  Сарыарка: 'saryarka',
  Байконур: 'baikonur',
  Нура: 'nura',
});
const SCORED_REGIONS = Object.freeze(Object.values(REGION_BY_DISTRICT));
const REGION_IDS = new Set(SCORED_REGIONS);
const INDICATOR_IDS = new Set(['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2']);
const TONES = new Set(['positive', 'negative', 'neutral']);
const STATUSES = new Set(['idle', 'playing', 'paused', 'complete']);
const isMeasure = (id) => typeof id === 'string' && /^M(?:[1-9]|1[0-4])$/.test(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const list = (value) => Array.isArray(value) ? value : [];

function uniqueRegions(values, fromDistrictNames = false) {
  const regions = new Set();
  for (const value of list(values)) {
    const regionId = fromDistrictNames ? REGION_BY_DISTRICT[value] : value;
    if (REGION_IDS.has(regionId)) regions.add(regionId);
  }
  return [...regions];
}

function selectDraft(preview) {
  const choices = new Map();
  for (const measure of list(preview?.measures)) {
    if (!isMeasure(measure?.id) || choices.has(measure.id)) continue;
    if (choices.size === EFFECT_LIMITS.maxMeasures) break;
    choices.set(measure.id, {
      measureId: measure.id,
      // City scope is always the five model regions, never the sixth context region.
      regionIds: measure.scope === 'city'
        ? [...SCORED_REGIONS]
        : uniqueRegions(measure.targets, true),
      lag: Number.isFinite(measure.lag) ? clamp(measure.lag, 0, EFFECT_LIMITS.horizon) : 0,
    });
  }
  return [...choices.values()];
}

function selectCues(presentation) {
  const cues = new Map();
  for (const cue of list(presentation.cues)) {
    if (!isMeasure(cue?.measureId) || cues.has(cue.measureId)) continue;
    cues.set(cue.measureId, {
      measureId: cue.measureId,
      regionIds: uniqueRegions(cue.regionIds),
      lag: Number.isFinite(cue.lag) ? clamp(cue.lag, 0, EFFECT_LIMITS.horizon) : 0,
    });
  }
  const ordered = new Set([...list(presentation.order), ...cues.keys()]);
  return [...ordered].filter((id) => cues.has(id))
    .slice(0, EFFECT_LIMITS.maxMeasures).map((id) => cues.get(id));
}

function selectReactions(presentation) {
  const reactions = new Map();
  for (const reaction of list(presentation.reactions)) {
    if (!REGION_IDS.has(reaction?.regionId) || !INDICATOR_IDS.has(reaction.indicator)
      || !Number.isFinite(reaction.delta) || !TONES.has(reaction.tone)) continue;
    const key = `${reaction.regionId}:${reaction.indicator}`;
    if (reactions.has(key)) continue;
    reactions.set(key, {
      regionId: reaction.regionId,
      indicator: reaction.indicator,
      delta: reaction.delta,
      tone: reaction.tone,
    });
    if (reactions.size === EFFECT_LIMITS.maxReactions) break;
  }
  return [...reactions.values()];
}

/**
 * Parent owns requestAnimationFrame and playback controls. This controller has no
 * timer, listener, engine dependency or numeric score/quarterly-score calculation.
 * onComplete receives the matching planRevision, once per completed run/replay.
 */
export function createEffects({ onComplete = () => {} } = {}) {
  let destroyed = false;
  let planRevision = null;
  let requestedStatus = 'idle';
  let status = 'idle';
  let quarter = 0;
  let speed = 1;
  let visible = true;
  let confirmed = false;
  let completionDelivered = false;
  let choices = [];
  let reactions = [];

  function complete() {
    quarter = EFFECT_LIMITS.horizon;
    status = 'complete';
    if (completionDelivered || !confirmed || destroyed) return;
    // Set the latch before calling the shell: dispatch can synchronously update or
    // destroy this controller, or replace the plan. Do not mutate after callback.
    completionDelivered = true;
    onComplete(planRevision);
  }

  function getState() {
    const markers = choices.flatMap((choice, index) => {
      // Quarter offsets communicate insertion order only; supplied lag controls
      // visual construction. These are not intermediate simulator outcomes.
      const start = index * 0.25;
      const finish = Math.min(EFFECT_LIMITS.horizon, start + choice.lag);
      const progress = !confirmed ? 0 : status === 'complete' ? 1
        : quarter < start ? 0 : finish === start ? 1
          : clamp((quarter - start) / (finish - start), 0, 1);
      const phase = !confirmed || quarter < start ? 'queued'
        : progress === 1 ? 'active' : 'construction';
      return choice.regionIds.map((regionId) => ({
        id: `${choice.measureId}:${regionId}`,
        measureId: choice.measureId,
        regionId,
        phase,
        progress,
      }));
    }).slice(0, EFFECT_LIMITS.maxMarkers);

    let feedback = choices.length ? 'Меры в очереди. Результат появится после расчёта.' : 'Выберите меры для города.';
    if (confirmed && status !== 'complete') {
      const feedbackByPhase = { queued: 'в очереди', construction: 'реализуется', active: 'введена' };
      const firstByMeasure = new Map(markers.map((marker) => [marker.measureId, marker]));
      feedback = [...firstByMeasure.values()]
        .map((marker) => `${marker.measureId}: ${feedbackByPhase[marker.phase]}`).join(' · ')
        || 'Воспроизведение рассчитанного сценария.';
      if (status === 'paused') feedback = `Пауза. ${feedback}`;
    }
    if (status === 'complete') {
      const positive = reactions.some((reaction) => reaction.tone === 'positive');
      const negative = reactions.some((reaction) => reaction.tone === 'negative');
      feedback = 'Сценарий завершён. ' + (negative
        ? positive ? 'Есть улучшения и ухудшения.' : 'Есть ухудшения показателей.'
        : 'Показаны рассчитанные изменения показателей.');
    }
    return {
      markers,
      reactions: status === 'complete' ? reactions.map((reaction) => ({ ...reaction })) : [],
      progress: quarter / EFFECT_LIMITS.horizon,
      quarter,
      status,
      feedback,
    };
  }

  function update({ snapshot, reducedMotion = false, visible: isVisible = true } = {}) {
    if (destroyed) return getState();
    const nextRevision = snapshot?.planRevision ?? null;
    const nextRequestedStatus = STATUSES.has(snapshot?.playback?.status) ? snapshot.playback.status : 'idle';
    const presentation = snapshot?.presentation;
    const nextConfirmed = snapshot?.contractVersion === 1 && snapshot?.result?.valid === true
      && presentation?.planRevision === nextRevision;
    const changedPlan = planRevision !== nextRevision;
    const replay = !changedPlan && requestedStatus === 'complete' && nextRequestedStatus === 'playing';
    if (changedPlan || replay || !nextConfirmed || !confirmed) {
      quarter = 0;
      completionDelivered = false;
      status = 'idle';
    }
    planRevision = nextRevision;
    requestedStatus = nextRequestedStatus;
    confirmed = Boolean(nextConfirmed);
    visible = isVisible !== false;
    speed = Number.isFinite(snapshot?.playback?.speed) && snapshot.playback.speed > 0
      ? Math.min(snapshot.playback.speed, EFFECT_LIMITS.maxSpeed) : 1;
    choices = confirmed ? selectCues(presentation) : selectDraft(snapshot?.preview);
    reactions = confirmed ? selectReactions(presentation) : [];
    if (!confirmed) return getState();
    if (status !== 'complete') status = nextRequestedStatus;
    if (nextRequestedStatus === 'complete'
      || (reducedMotion && (nextRequestedStatus === 'playing' || nextRequestedStatus === 'paused'))) {
      complete();
    }
    return getState();
  }

  function step(deltaSeconds) {
    if (destroyed || !visible || !confirmed || status !== 'playing'
      || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return getState();
    quarter = Math.min(EFFECT_LIMITS.horizon, quarter + deltaSeconds * speed / EFFECT_LIMITS.secondsPerQuarter);
    if (quarter === EFFECT_LIMITS.horizon) complete();
    return getState();
  }

  function destroy() {
    destroyed = true;
    confirmed = false;
    choices = [];
    reactions = [];
    quarter = 0;
    status = 'idle';
  }

  return { update, step, getState, destroy };
}
