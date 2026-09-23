import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMapVisualState } from '../scene/map-visual-state.js';
import { createEffects } from '../scene/effects.js';
import { createPresentation } from '../game/presentation.js';
import { previewPlan } from '../game/preview.js';
import { calculatePlan } from '../simulator.js';

const region = (state, id) => state.regions.find((item) => item.regionId === id);
const draft = (plan) => ({ preview: previewPlan(plan), result: null, presentation: null });
const choices = [
  { id: 'M11', district: 'Нура' }, { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' }, { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
];
function confirmed() {
  const result = calculatePlan(choices);
  return { ...draft(choices), contractVersion: 1, planRevision: 3, result,
    presentation: createPresentation(result, choices, 3),
    playback: { status: 'playing', runId: 1, speed: 1 } };
}

test('partial city preview targets exactly engine supplied districts, never the reference region', () => {
  const state = deriveMapVisualState({ snapshot: draft([{ id: 'M12', district: null }]) });
  assert.equal(state.mode, 'preview');
  for (const id of ['esil', 'almaty', 'saryarka', 'baikonur', 'nura']) {
    assert.deepEqual(region(state, id).effects, { C2: 4.375 });
    assert.deepEqual(region(state, id).measures, [{ id: 'M12', phase: 'preview', progress: 1 }]);
  }
  assert.deepEqual(region(state, 'saraishyk'), { regionId: 'saraishyk', effects: {}, measures: [] });
});

test('removal and district reassignment clear effects without mutating old descriptors', () => {
  const before = deriveMapVisualState({ snapshot: draft([{ id: 'M4', district: 'Нура' }]) });
  const moved = deriveMapVisualState({ snapshot: draft([{ id: 'M4', district: 'Есиль' }]) });
  assert.deepEqual(region(moved, 'nura').effects, {});
  assert.equal(region(moved, 'esil').effects.E1, 9);
  assert.equal(region(before, 'nura').effects.E1, 9);
  const removed = deriveMapVisualState({ snapshot: draft([]) });
  assert.equal(removed.mode, 'baseline');
  assert.ok(removed.regions.every((item) => !item.measures.length && !Object.keys(item.effects).length));
});

test('invalid plans suppress draft transformations; only the exact-five issue permits partial previews', () => {
  for (const plan of [
    [{ id: 'M4', district: 'Нура' }, { id: 'M7', district: 'Нура' }],
    [{ id: 'M7', district: null }],
    [{ id: 'M12', district: 'Нура' }],
    [...choices, { id: 'M2', district: null }],
    [ // Below budget with legal direction counts, but six choices is not a partial draft.
      { id: 'M9', district: 'Нура' }, { id: 'M11', district: 'Нура' },
      { id: 'M10', district: 'Нура' }, { id: 'M12', district: null },
      { id: 'M4', district: 'Нура' }, { id: 'M1', district: 'Нура' },
    ],
  ]) {
    const state = deriveMapVisualState({ snapshot: draft(plan) });
    assert.equal(state.mode, 'baseline');
    assert.ok(state.regions.every((item) => !item.measures.length));
  }
  const snapshot = draft([{ id: 'M4', district: 'Нура' }]);
  snapshot.preview.issues = [{ code: 'EXACTLY_FIVE_REQUIRED' }];
  assert.equal(deriveMapVisualState({ snapshot }).mode, 'preview');
});

test('playback gates effects until their own construction completes and preserves negative effects', () => {
  const snapshot = confirmed();
  const effects = createEffects();
  let effectState = effects.update({ snapshot });
  let state = deriveMapVisualState({ snapshot, effectState });
  assert.equal(state.mode, 'result');
  assert.deepEqual(region(state, 'nura').effects, {});
  assert.equal(region(state, 'nura').measures[0].phase, 'construction');
  effectState = effects.step(2);
  state = deriveMapVisualState({ snapshot, effectState });
  assert.deepEqual(region(state, 'nura').effects, { B2: 10.5, T1: -1.75 });
  assert.equal(region(state, 'nura').effects.S1, undefined);
  assert.equal(region(state, 'esil').effects.C2, undefined);
});

test('completion uses final reactions including synergies, replacing rather than adding active cue deltas', () => {
  const snapshot = confirmed();
  const effects = createEffects();
  effects.update({ snapshot });
  const effectState = effects.step(16);
  const state = deriveMapVisualState({ snapshot, effectState });
  assert.equal(region(state, 'nura').effects.B1, 12.5); // M10 plus fixed M10/M12 synergy.
  assert.equal(region(state, 'nura').effects.T1, -1.75);
  for (const reaction of snapshot.presentation.reactions) {
    assert.equal(region(state, reaction.regionId).effects[reaction.indicator] ?? 0, reaction.delta);
  }
  assert.ok(state.regions.flatMap((item) => item.measures).every((item) => item.phase === 'active' && item.progress === 1));
});

test('mismatched run, stale presentation, forged targets and malformed deltas cannot show old or invented effects', () => {
  const snapshot = confirmed();
  const effects = createEffects();
  effects.update({ snapshot });
  const effectState = effects.step(16);
  assert.equal(deriveMapVisualState({ snapshot: { ...snapshot, planRevision: 4 }, effectState }).mode, 'baseline');
  assert.equal(deriveMapVisualState({ snapshot: { ...snapshot, playback: { ...snapshot.playback, runId: 2 } }, effectState }).mode, 'baseline');
  const maliciousFrame = { ...effectState, status: 'playing', markers: [
    { measureId: 'M7', regionId: 'esil', phase: 'active', progress: 1 },
    { measureId: 'M7', regionId: 'saraishyk', phase: 'active', progress: 1 },
    { measureId: 'M99', regionId: 'nura', phase: 'active', progress: 1 },
  ] };
  assert.ok(deriveMapVisualState({ snapshot, effectState: maliciousFrame }).regions.every((item) => !item.measures.length));
  snapshot.presentation.reactions.push({ regionId: 'saraishyk', indicator: 'E2', delta: 99 });
  snapshot.presentation.reactions.push({ regionId: 'esil', indicator: 'unknown', delta: 99 });
  snapshot.presentation.reactions.push({ regionId: 'nura', indicator: 'S1', delta: Infinity });
  const final = deriveMapVisualState({ snapshot, effectState });
  assert.deepEqual(region(final, 'saraishyk').effects, {});
  assert.equal(region(final, 'esil').effects.unknown, undefined);
  assert.equal(region(final, 'nura').effects.S1, 10);
});

test('requested region order is deterministic and duplicate regions are removed', () => {
  const state = deriveMapVisualState({ snapshot: draft([{ id: 'M12', district: null }]),
    regionIds: ['saraishyk', 'nura', 'nura', 'unknown', 'esil'] });
  assert.deepEqual(state.regions.map((item) => item.regionId), ['saraishyk', 'nura', 'esil']);
  assert.deepEqual(deriveMapVisualState({ snapshot: draft([]), regionIds: [] }), { mode: 'baseline', regions: [] });
  assert.equal(deriveMapVisualState({ snapshot: { contractVersion: 1, result: { valid: true } } }).mode, 'baseline');
});
