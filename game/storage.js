import { RULES_VERSION, calculatePlan, validatePlan } from '../simulator.js';
import { getRegion, MODES, PROJECTIONS } from './contracts.js';

export const BEST_STORAGE_KEY = 'akim.personal-best.v1';
export const DRAFT_STORAGE_KEY = 'akim.draft.v1';
export const VIEW_STORAGE_KEY = 'akim.view.v1';
const STORAGE_VERSION = 1;
const editableErrors = new Set(['EXACTLY_FIVE_REQUIRED', 'DISTRICT_REQUIRED', 'DIRECTION_LIMIT_EXCEEDED', 'INCOMPATIBLE_GLOBAL_PAIR', 'INCOMPATIBLE_DISTRICT_PAIR']);

function readRecord(storage, key) {
  const raw = storageOrNull(storage)?.getItem(key);
  // All supported records are small; never parse an accidentally huge value.
  if (!raw || raw.length > 16384) return null;
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.rulesVersion !== RULES_VERSION) return null;
  // Existing v1 drafts predate the explicit schema field and remain recoverable.
  if (value.schemaVersion !== undefined && value.schemaVersion !== STORAGE_VERSION) return null;
  return value;
}

function draftAllowed(plan) {
  if (!Array.isArray(plan) || plan.length > 5) return false;
  return validatePlan(plan).errors.every((error) => editableErrors.has(error.code));
}

const copyDraft = (plan) => plan.map(({ id, district }) => ({ id, district: district === '' ? null : district ?? null }));

/** Recover only editable inputs. A draft never restores a score or animation. */
export function loadDraft(storage) {
  try {
    const value = readRecord(storage, DRAFT_STORAGE_KEY);
    if (!value || !draftAllowed(value.plan)) return [];
    return copyDraft(value.plan);
  } catch { return []; }
}

export function saveDraft(storage, plan) {
  try {
    if (!draftAllowed(plan)) return false;
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: STORAGE_VERSION, rulesVersion: RULES_VERSION, plan: copyDraft(plan) }));
    return true;
  } catch { return false; }
}

function normalizeView(value = {}) {
  const focusedRegion = getRegion(value.focusedRegion)?.regionId ?? null;
  return {
    mode: MODES.includes(value.mode) ? value.mode : 'game',
    projection: PROJECTIONS.includes(value.projection) ? value.projection : 'tilted',
    focusedRegion,
    view: value.view === 'district' && focusedRegion === 'nura' ? 'district' : 'overview',
  };
}

export function loadViewPreferences(storage) {
  try { return normalizeView(readRecord(storage, VIEW_STORAGE_KEY) ?? {}); }
  catch { return normalizeView(); }
}

export function saveViewPreferences(storage, view) {
  try {
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(VIEW_STORAGE_KEY, JSON.stringify({ schemaVersion: STORAGE_VERSION, rulesVersion: RULES_VERSION, ...normalizeView(view) }));
    return true;
  } catch { return false; }
}

function storageOrNull(storage) {
  try { return storage === undefined ? globalThis.localStorage ?? null : storage; } catch { return null; }
}

/** Saved scores are never trusted; a valid saved plan is recalculated. */
export function loadPersonalBest(storage) {
  try {
    const record = readRecord(storage, BEST_STORAGE_KEY);
    if (!record || !Array.isArray(record.plan)) return null;
    const result = calculatePlan(record.plan);
    if (!result.valid) return null;
    return { plan: result.plan, score: result.score, rulesVersion: RULES_VERSION };
  } catch { return null; }
}

/** Persist only the canonical valid plan; storage failure never breaks gameplay. */
export function savePersonalBest(storage, plan) {
  try {
    const result = calculatePlan(plan);
    if (!result.valid) return false;
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(BEST_STORAGE_KEY, JSON.stringify({ rulesVersion: RULES_VERSION, plan: result.plan }));
    return true;
  } catch { return false; }
}
