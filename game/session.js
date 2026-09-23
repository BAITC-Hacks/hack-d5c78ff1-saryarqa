import { DISTRICTS, MEASURES, RULES_VERSION, calculatePlan, validatePlan } from '../simulator.js';
import { CONTRACT_VERSION, getRegion } from './contracts.js';
import { previewPlan } from './preview.js';
import { createPresentation } from './presentation.js';
import { loadPersonalBest, savePersonalBest } from './storage.js';

const measures = new Map(MEASURES.map((item) => [item.id, item]));
const districts = new Set(DISTRICTS.map((item) => item.name));
const issue = (code, message) => ({ code, message });
const accepted = () => ({ ok: true });
const refused = (code, message) => ({ ok: false, error: issue(code, message) });

function freezeCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeCopy));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeCopy(item)])));
  }
  return value;
}

function normalizeDecision(input) {
  if (!input || typeof input !== 'object') return refused('INVALID_DECISION', 'Некорректное решение.');
  const measure = measures.get(input.id);
  if (!measure) return refused('UNKNOWN_MEASURE', `Неизвестная мера: ${String(input.id)}.`);
  const district = input.district ?? null;
  if (measure.scope === 'city') {
    if (district !== null) return refused('DISTRICT_FORBIDDEN', `${measure.id} действует на весь город.`);
    return { ok: true, decision: { id: measure.id, district: null } };
  }
  if (district === null || district === '') return { ok: true, decision: { id: measure.id, district: null } };
  if (district === 'Сарайшық' || district === 'saraishyk') return refused('UNSCORED_REGION', 'Сарайшық не входит в расчётную модель.');
  if (!districts.has(district)) return refused('UNKNOWN_DISTRICT', `Неизвестный район: ${String(district)}.`);
  return { ok: true, decision: { id: measure.id, district } };
}

/** One authoritative plan for the game scene and direct calculator. */
export function createGameSession({ storage, presentationFactory = createPresentation } = {}) {
  let destroyed = false;
  let nextRunId = 0;
  const subscribers = new Set();
  const state = {
    contractVersion: CONTRACT_VERSION,
    revision: 0,
    planRevision: 0,
    mode: 'game',
    projection: 'top',
    view: 'overview',
    focusedRegion: null,
    plan: [],
    validation: validatePlan([]),
    preview: previewPlan([]),
    result: null,
    presentation: null,
    playback: { status: 'idle', speed: 1, runId: 0 },
    personalBest: loadPersonalBest(storage),
  };

  const snapshot = () => freezeCopy(state);
  const notify = () => {
    const current = snapshot();
    for (const listener of subscribers) {
      try { listener(current); } catch { /* One observer must not block the session. */ }
    }
  };
  const changed = () => { state.revision += 1; notify(); return accepted(); };
  const editPlan = (plan) => {
    state.plan = plan;
    state.planRevision += 1;
    state.validation = validatePlan(plan);
    state.preview = previewPlan(plan);
    state.result = null;
    state.presentation = null;
    state.playback = { status: 'idle', speed: 1, runId: nextRunId };
    return changed();
  };

  function dispatch(action) {
    if (destroyed) return refused('SESSION_DESTROYED', 'Сессия закрыта.');
    if (!action || typeof action !== 'object') return refused('UNKNOWN_ACTION', 'Неизвестное действие.');
    switch (action.type) {
      case 'ADD_MEASURE': {
        const normalized = normalizeDecision(action);
        if (!normalized.ok) return normalized;
        if (state.plan.some((item) => item.id === normalized.decision.id)) return refused('DUPLICATE_MEASURE', 'Мера уже выбрана.');
        if (state.plan.length >= 5) return refused('EXACTLY_FIVE_REQUIRED', 'Можно выбрать ровно пять мер.');
        return editPlan([...state.plan, normalized.decision]);
      }
      case 'REMOVE_MEASURE': {
        if (!state.plan.some((item) => item.id === action.id)) return refused('MEASURE_NOT_SELECTED', 'Эта мера не выбрана.');
        return editPlan(state.plan.filter((item) => item.id !== action.id));
      }
      case 'ASSIGN_MEASURE': {
        const index = state.plan.findIndex((item) => item.id === action.id);
        if (index < 0) return refused('MEASURE_NOT_SELECTED', 'Эта мера не выбрана.');
        const normalized = normalizeDecision(action);
        if (!normalized.ok) return normalized;
        if (state.plan[index].district === normalized.decision.district) return accepted();
        const plan = state.plan.map((item, position) => position === index ? normalized.decision : item);
        return editPlan(plan);
      }
      case 'LOAD_PLAN': {
        if (!Array.isArray(action.plan) || action.plan.length > 5) return refused('INVALID_PLAN', 'План должен содержать не более пяти мер.');
        const plan = [];
        const ids = new Set();
        for (const input of action.plan) {
          const normalized = normalizeDecision(input);
          if (!normalized.ok) return normalized;
          if (ids.has(normalized.decision.id)) return refused('DUPLICATE_MEASURE', 'Мера повторяется в плане.');
          ids.add(normalized.decision.id);
          plan.push(normalized.decision);
        }
        return editPlan(plan);
      }
      case 'FOCUS_REGION': {
        if (action.regionId !== null && !getRegion(action.regionId)) return refused('UNKNOWN_REGION', 'Неизвестный район карты.');
        if (state.focusedRegion === action.regionId) return accepted();
        state.focusedRegion = action.regionId;
        if (action.regionId === null) state.view = 'overview';
        if (state.view === 'district' && action.regionId !== 'nura') state.view = 'overview';
        return changed();
      }
      case 'SET_MODE': {
        if (action.mode !== 'game' && action.mode !== 'calculator') return refused('UNKNOWN_MODE', 'Неизвестный режим.');
        if (state.mode === action.mode) return accepted();
        state.mode = action.mode;
        if (state.result && action.mode === 'calculator') state.playback = { ...state.playback, status: 'complete' };
        return changed();
      }
      case 'SET_PROJECTION': {
        if (action.projection !== 'top' && action.projection !== 'tilted') return refused('UNKNOWN_PROJECTION', 'Неизвестный вид карты.');
        if (state.projection === action.projection) return accepted();
        state.projection = action.projection;
        return changed();
      }
      case 'SET_VIEW': {
        if (action.view !== 'overview' && action.view !== 'district') return refused('UNKNOWN_VIEW', 'Неизвестный вид.');
        if (action.view === 'district' && !state.focusedRegion) return refused('REGION_REQUIRED', 'Сначала выберите район.');
        if (action.view === 'district' && state.focusedRegion !== 'nura') return refused('DETAIL_UNAVAILABLE', 'Подробная сцена этого района пока недоступна.');
        if (state.view === action.view) return accepted();
        state.view = action.view;
        return changed();
      }
      case 'FINALIZE': {
        if (state.result) return accepted();
        const result = calculatePlan(state.plan);
        state.validation = validatePlan(state.plan);
        if (!result.valid) return refused('INVALID_PLAN', result.errors.map((item) => item.message).join(' '));
        state.result = result;
        state.presentation = presentationFactory(result, state.plan, state.planRevision);
        nextRunId += 1;
        state.playback = { status: state.mode === 'game' && state.presentation ? 'playing' : 'complete', speed: 1, runId: nextRunId };
        if (!state.personalBest || result.score > state.personalBest.score) {
          state.personalBest = { plan: result.plan, score: result.score, rulesVersion: RULES_VERSION };
          savePersonalBest(storage, result.plan);
          state.personalBest = loadPersonalBest(storage) ?? state.personalBest;
        }
        return changed();
      }
      case 'RESET': {
        return editPlan([]);
      }
      case 'PLAYBACK_CONTROL': {
        if (!state.result) return refused('NO_RESULT', 'Сначала завершите действительный план.');
        const command = action.command;
        if (command === 'speed') {
          if (typeof action.speed !== 'number' || !Number.isFinite(action.speed) || action.speed < 0.25 || action.speed > 4) return refused('INVALID_SPEED', 'Скорость должна быть от 0,25 до 4.');
          if (state.playback.speed === action.speed) return accepted();
          state.playback = { ...state.playback, speed: action.speed };
        } else if (command === 'pause') {
          if (state.playback.status !== 'playing') return refused('INVALID_PLAYBACK_STATE', 'Воспроизведение сейчас не идёт.');
          state.playback = { ...state.playback, status: 'paused' };
        } else if (command === 'play') {
          if (state.playback.status !== 'paused') return refused('INVALID_PLAYBACK_STATE', 'Воспроизведение не приостановлено.');
          state.playback = { ...state.playback, status: 'playing' };
        } else if (command === 'skip') {
          if (state.playback.status === 'complete') return accepted();
          state.playback = { ...state.playback, status: 'complete' };
        } else if (command === 'replay') {
          nextRunId += 1;
          state.playback = { ...state.playback, status: 'playing', runId: nextRunId };
        } else return refused('UNKNOWN_PLAYBACK_COMMAND', 'Неизвестная команда воспроизведения.');
        return changed();
      }
      case 'PLAYBACK_COMPLETE': {
        if (!state.result || action.planRevision !== state.planRevision || action.runId !== state.playback.runId) return refused('STALE_PLAYBACK', 'Старое воспроизведение отменено.');
        if (state.playback.status === 'complete') return accepted();
        if (state.playback.status !== 'playing') return refused('INVALID_PLAYBACK_STATE', 'Воспроизведение сейчас не идёт.');
        state.playback = { ...state.playback, status: 'complete' };
        return changed();
      }
      default: return refused('UNKNOWN_ACTION', 'Неизвестное действие.');
    }
  }

  return {
    getSnapshot: snapshot,
    dispatch,
    subscribe(listener) {
      if (destroyed || typeof listener !== 'function') return () => {};
      subscribers.add(listener);
      try { listener(snapshot()); } catch { /* Isolate observers. */ }
      return () => subscribers.delete(listener);
    },
    destroy() { destroyed = true; subscribers.clear(); },
  };
}
