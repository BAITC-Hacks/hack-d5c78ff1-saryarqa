import { RULES_VERSION, calculatePlan } from '../simulator.js';

export const BEST_STORAGE_KEY = 'akim.personal-best.v1';

function storageOrNull(storage) {
  try { return storage ?? globalThis.localStorage ?? null; } catch { return null; }
}

/** Saved scores are never trusted; a valid saved plan is recalculated. */
export function loadPersonalBest(storage) {
  try {
    const raw = storageOrNull(storage)?.getItem(BEST_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || record.rulesVersion !== RULES_VERSION || !Array.isArray(record.plan)) return null;
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
