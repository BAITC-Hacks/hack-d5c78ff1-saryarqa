import test from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, EFFECT_LIMITS } from '../scene/effects.js';

const regions = ['esil', 'almaty', 'saryarka', 'baikonur', 'nura'];
const indicators = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'];

function snapshot(overrides = {}) {
  return {
    contractVersion: 1,
    revision: 1,
    planRevision: 4,
    preview: {
      measures: [
        { id: 'M7', scope: 'district', targets: ['Нура'], lag: 3 },
        { id: 'M12', scope: 'city', targets: [], lag: 1 },
      ],
      score: null,
    },
    result: { valid: true, score: 61.23 },
    presentation: {
      planRevision: 4,
      horizon: 8,
      order: ['M7', 'M12'],
      cues: [
        { measureId: 'M12', regionIds: regions, lag: 1, effects: { C2: 4.375 } },
        { measureId: 'M7', regionIds: ['nura'], lag: 3, effects: { S1: 10 } },
      ],
      reactions: [
        { regionId: 'nura', indicator: 'S1', delta: 10, tone: 'positive' },
        { regionId: 'nura', indicator: 'T1', delta: -1.75, tone: 'negative' },
      ],
    },
    playback: { status: 'playing', speed: 1 },
    ...overrides,
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

test('draft markers use explicit district identities, city scope has exactly five model regions', () => {
  const effects = createEffects();
  const state = effects.update({ snapshot: snapshot({ result: null, presentation: null }) });
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.markers.filter((marker) => marker.measureId === 'M12').map((marker) => marker.regionId), regions);
  assert.equal(state.markers.find((marker) => marker.measureId === 'M7').regionId, 'nura');
  assert.ok(state.markers.every((marker) => marker.phase === 'queued' && marker.progress === 0));
  assert.deepEqual(state.reactions, []);
  assert.equal(state.progress, 0);
});

test('preview removal and unassigned/unknown targets leave no stale or fabricated markers', () => {
  const effects = createEffects();
  effects.update({ snapshot: snapshot({ result: null, presentation: null }) });
  const state = effects.update({ snapshot: snapshot({
    planRevision: 5,
    result: null,
    presentation: null,
    preview: { measures: [
      { id: 'M7', scope: 'district', targets: [] },
      { id: 'M8', scope: 'district', targets: ['Сарайшық', 'nura', 'Нура район', 'Нура', 'Нура'] },
    ] },
  }) });
  assert.deepEqual(state.markers.map((marker) => marker.id), ['M8:nura']);
});

test('ordered cues and supplied lags control construction, without intermediate result reactions', () => {
  const effects = createEffects();
  let state = effects.update({ snapshot: snapshot() });
  assert.equal(state.markers[0].measureId, 'M7');
  assert.equal(state.markers[0].phase, 'construction');
  assert.equal(state.markers[1].phase, 'queued');
  state = effects.step(3); // quarter 1.5
  assert.equal(state.quarter, 1.5);
  assert.equal(state.markers[0].progress, 0.5);
  assert.equal(state.markers[0].phase, 'construction');
  assert.equal(state.markers[1].phase, 'active');
  assert.match(state.feedback, /M7: реализуется/);
  assert.match(state.feedback, /M12: введена/);
  assert.deepEqual(state.reactions, []);
});

test('pause, hidden state and idempotent updates preserve timeline; speed changes timing only', () => {
  const effects = createEffects();
  const initial = snapshot();
  effects.update({ snapshot: initial });
  effects.step(4);
  effects.update({ snapshot: initial });
  assert.equal(effects.getState().quarter, 2);
  effects.update({ snapshot: initial, visible: false });
  assert.equal(effects.step(100).quarter, 2);
  effects.update({ snapshot: snapshot({ playback: { status: 'paused', speed: 2 } }) });
  assert.equal(effects.step(100).quarter, 2);
  effects.update({ snapshot: snapshot({ playback: { status: 'playing', speed: 2 } }) });
  assert.equal(effects.step(2).quarter, 4);
  assert.equal(initial.result.score, 61.23);
});

test('normal completion, skip and reduced motion give identical final markers/reactions', () => {
  const results = [];
  for (const mode of ['normal', 'skip', 'reduced', 'paused-reduced']) {
    const completed = [];
    const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
    effects.update({ snapshot: snapshot({ playback: { status: mode === 'skip' ? 'complete' : mode === 'paused-reduced' ? 'paused' : 'playing', speed: 1 } }), reducedMotion: mode.includes('reduced') });
    if (mode === 'normal') effects.step(16);
    effects.step(100);
    assert.deepEqual(completed, [4]);
    const final = effects.getState();
    assert.equal(final.progress, 1);
    assert.equal(final.quarter, 8);
    assert.equal(final.status, 'complete');
    assert.ok(final.markers.every((marker) => marker.phase === 'active' && marker.progress === 1));
    assert.match(final.feedback, /улучшения и ухудшения/);
    results.push(final);
  }
  results.forEach((result) => assert.deepEqual(result, results[0]));
});

test('completion is once per run and replay of the same plan resets and completes once again', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot() });
  effects.step(16);
  effects.update({ snapshot: snapshot() });
  effects.step(100);
  effects.update({ snapshot: snapshot({ playback: { status: 'complete', speed: 1 } }) });
  assert.deepEqual(completed, [4]);
  effects.update({ snapshot: snapshot() });
  assert.equal(effects.getState().quarter, 0);
  assert.equal(effects.getState().status, 'playing');
  assert.deepEqual(effects.getState().reactions, []);
  effects.step(16);
  assert.deepEqual(completed, [4, 4]);
});

test('a new plan cancels old presentation; stale metadata cannot emit completion or reactions', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot() });
  effects.step(12);
  effects.update({ snapshot: snapshot({ planRevision: 5 }) });
  const state = effects.step(100);
  assert.equal(state.status, 'idle');
  assert.equal(state.progress, 0);
  assert.deepEqual(state.reactions, []);
  assert.deepEqual(completed, []);
});

test('synchronous completion callbacks may update to complete without recursive completion', () => {
  let calls = 0;
  const effects = createEffects({ onComplete: (revision) => {
    calls += 1;
    assert.equal(revision, 4);
    assert.equal(effects.getState().status, 'complete');
    effects.update({ snapshot: snapshot({ playback: { status: 'complete', speed: 1 } }) });
  } });
  effects.update({ snapshot: snapshot(), reducedMotion: true });
  assert.equal(calls, 1);
  assert.equal(effects.getState().status, 'complete');
});

test('synchronous completion callbacks may replace the plan without old state overwriting it', () => {
  const effects = createEffects({ onComplete: () => {
    effects.update({ snapshot: snapshot({
      planRevision: 5,
      result: null,
      presentation: null,
      preview: { measures: [] },
      playback: { status: 'idle', speed: 1 },
    }) });
  } });
  effects.update({ snapshot: snapshot() });
  const state = effects.step(16);
  assert.equal(state.progress, 0);
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.markers, []);
});

test('selectors bound duplicate/invalid inputs and exclude the context-only region', () => {
  const effects = createEffects();
  const source = snapshot();
  source.presentation.order = Array.from({ length: 14 }, (_, index) => `M${index + 1}`);
  source.presentation.cues = source.presentation.order.flatMap((measureId) => [
    { measureId, regionIds: [...regions, 'saraishyk', 'nura', 'unknown'], lag: 1 },
    { measureId, regionIds: regions, lag: 1 },
  ]);
  source.presentation.reactions = [
    { regionId: 'saraishyk', indicator: 'T1', delta: 10, tone: 'positive' },
    { regionId: 'nura', indicator: 'T1', delta: NaN, tone: 'positive' },
    { regionId: 'nura', indicator: 'made-up', delta: 10, tone: 'positive' },
    { regionId: 'nura', indicator: 'T1', delta: 10, tone: 'cheering' },
    ...regions.flatMap((regionId) => indicators.flatMap((indicator) => [
      { regionId, indicator, delta: -1, tone: 'negative' },
      { regionId, indicator, delta: 20, tone: 'positive' },
    ])),
  ];
  const state = effects.update({ snapshot: source, reducedMotion: true });
  assert.equal(state.markers.length, EFFECT_LIMITS.maxMarkers);
  assert.equal(new Set(state.markers.map((marker) => marker.id)).size, EFFECT_LIMITS.maxMarkers);
  assert.equal(state.reactions.length, EFFECT_LIMITS.maxReactions);
  assert.ok(state.markers.every((marker) => marker.regionId !== 'saraishyk'));
  assert.ok(state.reactions.every((reaction) => reaction.delta === -1 && reaction.tone === 'negative'));
  assert.match(state.feedback, /ухудшения/);
  assert.doesNotMatch(state.feedback, /улучшения/);
});

test('snapshots stay read only and returned state cannot mutate the controller', () => {
  const source = freezeDeep(snapshot());
  const before = JSON.stringify(source);
  const effects = createEffects();
  const state = effects.update({ snapshot: source, reducedMotion: true });
  state.markers[0].regionId = 'saraishyk';
  state.reactions[0].delta = 900;
  assert.equal(effects.getState().markers[0].regionId, 'nura');
  assert.equal(effects.getState().reactions[0].delta, 10);
  assert.equal(JSON.stringify(source), before);
});

test('invalid outcomes do not animate and destroy permanently releases visible state', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot({ result: { valid: false, score: null } }), reducedMotion: true });
  assert.equal(effects.step(16).status, 'idle');
  effects.update({ snapshot: snapshot() });
  effects.step(4);
  effects.destroy();
  effects.destroy();
  effects.update({ snapshot: snapshot(), reducedMotion: true });
  assert.deepEqual(effects.step(16).markers, []);
  assert.equal(effects.getState().status, 'idle');
  assert.deepEqual(completed, []);
});

test('non-finite or non-positive frame deltas cannot advance or poison the timeline', () => {
  const effects = createEffects();
  effects.update({ snapshot: snapshot() });
  for (const delta of [NaN, Infinity, -1, 0, '10', undefined]) effects.step(delta);
  assert.equal(effects.getState().quarter, 0);
  effects.step(2);
  assert.equal(effects.getState().quarter, 1);
});
