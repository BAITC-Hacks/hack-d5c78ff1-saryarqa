import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession } from '../game/session.js';

const sample = [
  { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
const loadSample = (session) => assert.equal(session.dispatch({ type: 'LOAD_PLAN', plan: sample }).ok, true);

test('subscriptions are immediate and immutable, with one plan in both modes', () => {
  const session = createGameSession({ storage: null });
  const seen = [];
  const unsubscribe = session.subscribe((snapshot) => seen.push(snapshot));
  assert.equal(seen.length, 1);
  assert.ok(Object.isFrozen(seen[0].plan));
  assert.throws(() => seen[0].plan.push(sample[0]), TypeError);
  loadSample(session);
  const planRevision = session.getSnapshot().planRevision;
  session.dispatch({ type: 'SET_MODE', mode: 'calculator' });
  session.dispatch({ type: 'SET_PROJECTION', projection: 'tilted' });
  assert.deepEqual(session.getSnapshot().plan, sample);
  assert.equal(session.getSnapshot().planRevision, planRevision);
  unsubscribe();
  const count = seen.length;
  session.dispatch({ type: 'SET_PROJECTION', projection: 'top' });
  assert.equal(seen.length, count);
  session.destroy();
  assert.equal(session.dispatch({ type: 'RESET' }).error.code, 'SESSION_DESTROYED');
});

test('incomplete and invalid drafts never have a result; sixth, duplicate and Saraishyk are refused', () => {
  const session = createGameSession({ storage: null });
  assert.equal(session.dispatch({ type: 'ADD_MEASURE', id: 'M7', district: null }).ok, true);
  assert.equal(session.getSnapshot().preview.score, null);
  assert.equal(session.dispatch({ type: 'FINALIZE' }).ok, false);
  assert.equal(session.getSnapshot().result, null);
  assert.equal(session.dispatch({ type: 'ADD_MEASURE', id: 'M7', district: 'Нура' }).error.code, 'DUPLICATE_MEASURE');
  assert.equal(session.dispatch({ type: 'ASSIGN_MEASURE', id: 'M7', district: 'Сарайшық' }).error.code, 'UNSCORED_REGION');
  loadSample(session);
  assert.equal(session.dispatch({ type: 'ADD_MEASURE', id: 'M9', district: 'Нура' }).error.code, 'EXACTLY_FIVE_REQUIRED');
  assert.equal(session.getSnapshot().result, null);
  session.destroy();
});

test('official sample finalizes once and Calculator/Game share the same score', () => {
  const session = createGameSession({ storage: null });
  loadSample(session);
  assert.equal(session.dispatch({ type: 'FINALIZE' }).ok, true);
  const first = session.getSnapshot();
  assert.ok(Math.abs(first.result.score - 56.54307) < 1e-10);
  assert.equal(first.playback.status, 'playing');
  assert.equal(first.personalBest.rulesVersion, 'hackalem-v1');
  const runId = first.playback.runId;
  session.dispatch({ type: 'SET_MODE', mode: 'calculator' });
  const direct = session.getSnapshot();
  assert.equal(direct.playback.status, 'complete');
  assert.equal(direct.result.score, first.result.score);
  session.dispatch({ type: 'SET_MODE', mode: 'game' });
  assert.equal(session.getSnapshot().playback.status, 'complete');
  session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'replay' });
  assert.equal(session.getSnapshot().result.score, first.result.score);
  assert.ok(session.getSnapshot().playback.runId > runId);
  session.destroy();
});

test('plan edits invalidate outcome and old animation callbacks, but view controls do not', () => {
  const session = createGameSession({ storage: null });
  loadSample(session);
  session.dispatch({ type: 'FINALIZE' });
  const old = session.getSnapshot();
  session.dispatch({ type: 'FOCUS_REGION', regionId: 'nura' });
  session.dispatch({ type: 'SET_VIEW', view: 'district' });
  session.dispatch({ type: 'SET_PROJECTION', projection: 'tilted' });
  assert.equal(session.getSnapshot().result.score, old.result.score);
  session.dispatch({ type: 'ASSIGN_MEASURE', id: 'M5', district: 'Есиль' });
  const edited = session.getSnapshot();
  assert.equal(edited.result, null);
  assert.equal(edited.presentation, null);
  assert.equal(edited.playback.status, 'idle');
  assert.ok(edited.planRevision > old.planRevision);
  assert.equal(session.dispatch({ type: 'PLAYBACK_COMPLETE', planRevision: old.planRevision, runId: old.playback.runId }).error.code, 'STALE_PLAYBACK');
  session.destroy();
});

test('replay run IDs reject stale completion and skip never changes score/best', () => {
  const session = createGameSession({ storage: null });
  loadSample(session);
  session.dispatch({ type: 'FINALIZE' });
  const old = session.getSnapshot();
  session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'replay' });
  const current = session.getSnapshot();
  assert.equal(session.dispatch({ type: 'PLAYBACK_COMPLETE', planRevision: current.planRevision, runId: old.playback.runId }).error.code, 'STALE_PLAYBACK');
  assert.equal(session.dispatch({ type: 'PLAYBACK_COMPLETE', planRevision: current.planRevision }).error.code, 'STALE_PLAYBACK');
  assert.equal(session.getSnapshot().playback.status, 'playing');
  session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' });
  const after = session.getSnapshot();
  assert.equal(after.playback.status, 'complete');
  assert.equal(after.result.score, old.result.score);
  assert.deepEqual(after.personalBest, old.personalBest);
  session.destroy();
});

test('missing presentation metadata reveals the valid result without starting playback', () => {
  const session = createGameSession({ storage: null, presentationFactory: () => null });
  loadSample(session);
  assert.equal(session.dispatch({ type: 'FINALIZE' }).ok, true);
  const state = session.getSnapshot();
  assert.ok(Math.abs(state.result.score - 56.54307) < 1e-10);
  assert.equal(state.presentation, null);
  assert.equal(state.playback.status, 'complete');
  session.destroy();
});

test('only Нура has a detailed scene; Сарайшық is context only', () => {
  const session = createGameSession({ storage: null });
  assert.equal(session.dispatch({ type: 'FOCUS_REGION', regionId: 'saraishyk' }).ok, true);
  assert.equal(session.dispatch({ type: 'SET_VIEW', view: 'district' }).error.code, 'DETAIL_UNAVAILABLE');
  assert.equal(session.getSnapshot().view, 'overview');
  assert.equal(session.dispatch({ type: 'ADD_MEASURE', id: 'M8', district: 'saraishyk' }).error.code, 'UNSCORED_REGION');
  session.dispatch({ type: 'FOCUS_REGION', regionId: 'nura' });
  assert.equal(session.dispatch({ type: 'SET_VIEW', view: 'district' }).ok, true);
  session.destroy();
});
