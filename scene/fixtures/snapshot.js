// Presentation-only fixture. No score, budget or engine result is calculated here.
export const cityData = { schemaVersion: 1, sources: [], observations: [
  { id: 'population-unavailable', metric: 'population', regionId: 'city', value: null, unit: 'человек', asOf: null,
    sourceId: null, definition: 'Численность населения', status: 'unavailable', note: 'Ожидаются проверенные данные от команды 03.' },
] };
export function createSnapshot() {
  return { contractVersion: 1, revision: 0, planRevision: 0, mode: 'game', projection: 'tilted', view: 'overview',
    focusedRegion: null, plan: [], validation: {}, preview: { measures: [], issues: [], score: null }, result: null,
    presentation: null, playback: { status: 'idle', speed: 1, runId: 0 }, personalBest: null };
}
export function demoPreview() {
  return [{ id: 'M7', scope: 'district', targets: ['Нура'], cost: 0, lag: 2, factor: 1, effects: {} },
    { id: 'M12', scope: 'city', targets: ['Есиль', 'Алматы', 'Сарыарка', 'Байконур', 'Нура'], cost: 0, lag: 1, factor: 1, effects: {} }];
}
export function demoPresentation(planRevision) {
  return { planRevision, horizon: 8, order: ['M7', 'M12'], cues: [
    { measureId: 'M7', regionIds: ['nura'], lag: 2, effects: {} },
    { measureId: 'M12', regionIds: ['esil', 'almaty', 'saryarka', 'baikonur', 'nura'], lag: 1, effects: {} },
  ], reactions: [{ regionId: 'nura', indicator: 'S1', delta: 4, tone: 'positive' },
    { regionId: 'nura', indicator: 'E2', delta: -2, tone: 'negative' }] };
}
