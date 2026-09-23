/** Shared scene/session contract v1. Geography is supplied separately by its owner. */
export const CONTRACT_VERSION = 1;
export const REGIONS = Object.freeze([
  { regionId: 'esil', label: 'Есиль', simulationDistrict: 'Есиль' },
  { regionId: 'almaty', label: 'Алматы', simulationDistrict: 'Алматы' },
  { regionId: 'saryarka', label: 'Сарыарка', simulationDistrict: 'Сарыарка' },
  { regionId: 'baikonur', label: 'Байконур', simulationDistrict: 'Байконур' },
  { regionId: 'nura', label: 'Нура', simulationDistrict: 'Нура' },
  { regionId: 'saraishyk', label: 'Сарайшық', simulationDistrict: null },
].map(Object.freeze));
export const MODES = Object.freeze(['game', 'calculator']);
export const PROJECTIONS = Object.freeze(['top', 'tilted']);
export const getRegion = (id) => REGIONS.find((region) => region.regionId === id) ?? null;
export const regionIdForDistrict = (district) => REGIONS.find((region) => region.simulationDistrict === district)?.regionId ?? null;

/** @typedef {{ id: string, district: string|null }} Decision */
/** @typedef {{ status: 'idle'|'playing'|'paused'|'complete', speed: number, runId: number }} Playback */
/**
 * Scene module: createScene({root, assets, geography, onIntent}) -> {update, destroy}.
 * update({snapshot, context:{cityData, reducedMotion, visible}}) is idempotent.
 * Scene intents use docs/team/04-CONTRACTS.md. It never computes or mutates scores.
 */
