import { createScene } from './index.js';
import { geography as fixtureGeography } from './fixtures/geography.js';
import { assets as fixtureAssets } from './fixtures/assets.js';
import { createSnapshot, cityData as fixtureCityData, demoPreview, demoPresentation } from './fixtures/snapshot.js';

// ?data=approved consumes the exact files supplied by the lead/asset owner.
// Failure stays visible; it never silently substitutes fixture geography.
const approved = new URLSearchParams(location.search).get('data') === 'approved';
async function load(path) { const response = await fetch(new URL(path, import.meta.url)); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json(); }
let geography = fixtureGeography, assets = fixtureAssets, cityData = fixtureCityData;
let snapshot = createSnapshot();
const media = matchMedia('(prefers-reduced-motion: reduce)');
const context = { cityData, visible: true, reducedMotion: media.matches };
let scene;
const root = document.querySelector('#scene-root');
const $ = id => document.getElementById(id);
$('reduced').checked = context.reducedMotion;
const intents = [];
function render() {
  scene.update({ snapshot, context });
  $('dev-status').textContent = `Режим: ${snapshot.mode} · воспроизведение: ${snapshot.playback.status} · версия плана: ${snapshot.planRevision}`;
}
function onIntent(intent) {
  intents.push(structuredClone(intent));
  if (intent.type === 'FOCUS_REGION') snapshot.focusedRegion = intent.regionId;
  else if (intent.type === 'SET_PROJECTION') snapshot.projection = intent.projection;
  else if (intent.type === 'SET_VIEW') snapshot.view = intent.view;
  else if (intent.type === 'PLAYBACK_COMPLETE' && intent.planRevision === snapshot.planRevision) snapshot.playback.status = 'complete';
  snapshot.revision++; render();
}
function preview() {
  snapshot.planRevision++; snapshot.preview.measures = demoPreview();
  snapshot.plan = [{ id: 'M7', district: 'Нура' }, { id: 'M12', district: null }];
  snapshot.result = null; snapshot.presentation = null; snapshot.playback.status = 'idle'; render();
}
function play() {
  if (!snapshot.plan.length) preview();
  snapshot.result = { valid: true, fixture: true };
  snapshot.presentation = demoPresentation(snapshot.planRevision);
  snapshot.playback.status = 'playing'; render();
}
try {
  if (approved) {
    [geography, assets, cityData] = await Promise.all([load('../data/geography/astana.json'), load('../assets/game/manifest.json'), load('../data/city/context.json')]);
    context.cityData = cityData;
  }
  scene = createScene({ root, assets, geography, onIntent }); render();
  $('preview').onclick = preview;
  $('clear').onclick = () => { const previous = snapshot; snapshot = { ...createSnapshot(), planRevision: previous.planRevision + 1, focusedRegion: previous.focusedRegion, view: previous.view, projection: previous.projection }; render(); };
  $('play').onclick = play;
  $('pause').onclick = () => { if (snapshot.presentation && snapshot.playback.status !== 'complete') { snapshot.playback.status = snapshot.playback.status === 'paused' ? 'playing' : 'paused'; render(); } };
  $('skip').onclick = () => { if (snapshot.presentation) { snapshot.playback.status = 'complete'; render(); } };
  $('replay').onclick = () => { if (snapshot.presentation) { snapshot.playback.status = 'complete'; render(); snapshot.playback.status = 'playing'; render(); } };
  $('speed').onchange = event => { snapshot.playback.speed = Number(event.target.value); render(); };
  $('reduced').onchange = event => { context.reducedMotion = event.target.checked; render(); };
  $('hidden').onchange = event => { context.visible = !event.target.checked; snapshot.mode = event.target.checked ? 'calculator' : 'game'; if (event.target.checked && snapshot.presentation) snapshot.playback.status = 'complete'; render(); };
  $('remount').onclick = () => { scene.destroy(); scene = createScene({ root, assets, geography, onIntent }); render(); };
  media.addEventListener('change', event => { context.reducedMotion = event.matches; $('reduced').checked = event.matches; render(); });
  // Deliberate test-only API: diagnostics and fixture controls, never used by the app shell.
  window.akimSceneDev = { get scene() { return scene; }, get snapshot() { return structuredClone(snapshot); }, intents,
    update(patch, contextPatch = {}) { Object.assign(snapshot, patch); Object.assign(context, contextPatch); render(); },
    remount() { $('remount').click(); }, geography, assets };
} catch (error) { $('dev-status').textContent = `Сцена не загружена: ${error.message}`; console.error(error); }
