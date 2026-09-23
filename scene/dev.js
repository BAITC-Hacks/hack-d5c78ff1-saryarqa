import { createScene } from './index.js';
import { createGameSession } from '../game/session.js';
import { geography as fixtureGeography } from './fixtures/geography.js';
import { assets as fixtureAssets } from './fixtures/assets.js';
import { cityData as fixtureCityData } from './fixtures/snapshot.js';

// ?data=approved consumes the exact files supplied by the lead/asset owner.
// Failure stays visible; it never silently substitutes fixture geography.
const approved = new URLSearchParams(location.search).get('data') === 'approved';
async function load(path) { const response = await fetch(new URL(path, import.meta.url)); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json(); }
let geography = fixtureGeography, assets = fixtureAssets, cityData = fixtureCityData;
const session = createGameSession({ storage: null });
const media = matchMedia('(prefers-reduced-motion: reduce)');
const context = { cityData, visible: true, reducedMotion: media.matches };
let scene;
const root = document.querySelector('#scene-root');
const $ = id => document.getElementById(id);
$('reduced').checked = context.reducedMotion;
const intents = [];
const officialSample = [
  { id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
function render() {
  if (!scene) return;
  scene.update({ snapshot: session.getSnapshot(), context });
  const snapshot = session.getSnapshot(); // Reduced motion can complete synchronously.
  const revealed = snapshot.result && (snapshot.mode === 'calculator' || snapshot.playback.status === 'complete');
  $('dev-status').textContent = `Режим: ${snapshot.mode} · воспроизведение: ${snapshot.playback.status} · версия плана: ${snapshot.planRevision} · запуск: ${snapshot.playback.runId} · ${revealed ? `счёт модели: ${snapshot.result.score}` : 'итог ещё не раскрыт'}`;
}
function onIntent(intent) {
  intents.push(structuredClone(intent));
  session.dispatch(intent);
}
function preview() {
  session.dispatch({ type: 'LOAD_PLAN', plan: officialSample.slice(0, 2) });
}
function play() {
  if (!session.getSnapshot().validation.valid) session.dispatch({ type: 'LOAD_PLAN', plan: officialSample });
  session.dispatch({ type: 'FINALIZE' });
}
try {
  if (approved) {
    [geography, assets, cityData] = await Promise.all([load('../data/geography/astana.json'), load('../assets/game/manifest.json'), load('../data/city/context.json')]);
    context.cityData = cityData;
  }
  scene = createScene({ root, assets, geography, onIntent });
  const unsubscribe = session.subscribe(render);
  $('preview').onclick = preview;
  $('clear').onclick = () => session.dispatch({ type: 'RESET' });
  $('play').onclick = play;
  $('pause').onclick = () => session.dispatch({ type: 'PLAYBACK_CONTROL', command: session.getSnapshot().playback.status === 'paused' ? 'play' : 'pause' });
  $('skip').onclick = () => session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' });
  $('replay').onclick = () => session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'replay' });
  $('speed').onchange = event => session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'speed', speed: Number(event.target.value) });
  $('reduced').onchange = event => { context.reducedMotion = event.target.checked; render(); };
  $('hidden').onchange = event => { context.visible = !event.target.checked; session.dispatch({ type: 'SET_MODE', mode: event.target.checked ? 'calculator' : 'game' }); };
  $('remount').onclick = () => { scene.destroy(); scene = createScene({ root, assets, geography, onIntent }); render(); };
  const changeMotion = event => { context.reducedMotion = event.matches; $('reduced').checked = event.matches; render(); };
  media.addEventListener('change', changeMotion);
  // Deliberate test-only API: diagnostics and fixture controls, never used by the app shell.
  window.akimSceneDev = { get scene() { return scene; }, get snapshot() { return session.getSnapshot(); }, intents,
    dispatch: action => session.dispatch(action),
    setContext(patch) { Object.assign(context, patch); render(); },
    remount() { $('remount').click(); }, geography, assets };
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    unsubscribe(); scene.destroy(); session.destroy(); media.removeEventListener('change', changeMotion);
  });
} catch (error) { $('dev-status').textContent = `Сцена не загружена: ${error.message}`; console.error(error); }
