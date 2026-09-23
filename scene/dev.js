import { createScene } from './index.js';
import { loadAstanaMap } from './load-map.js';
import { createPlayPanel } from './play-panel.js';
import { createGameSession } from '../game/session.js';
import { geography as fixtureGeography } from './fixtures/geography.js';
import { assets as fixtureAssets } from './fixtures/assets.js';
import { cityData as fixtureCityData } from './fixtures/snapshot.js';

const $ = id => document.getElementById(id);
const fixture = new URLSearchParams(location.search).get('data') === 'fixture';
if (fixture) location.replace(new URL('./dev-fixture.html', location.href));
const root = $('scene-root'), media = matchMedia('(prefers-reduced-motion: reduce)');
const context = { cityData: fixtureCityData, reducedMotion: media.matches, visible: true };
let storage; try { storage = localStorage; } catch { storage = undefined; }
const session = createGameSession({ storage });
session.dispatch({ type: 'SET_PROJECTION', projection: 'tilted' });
let scene, panel, mapData, unsubscribe;
const intents = [];
function onIntent(intent) { intents.push(structuredClone(intent)); session.dispatch(intent); }
function render(snapshot = session.getSnapshot()) { scene?.update({ snapshot, context }); }
function diagnostics() { $('dev-status').textContent = JSON.stringify({ snapshot: session.getSnapshot(), scene: scene?.getDiagnostics() }, null, 2); }
function mount() {
  panel?.destroy(); scene?.destroy(); root.replaceChildren();
  scene = createScene({ root, assets: fixtureAssets, geography: fixtureGeography, ...(mapData ? { mapData } : {}), onIntent });
  render();
  if (mapData) { const hud = document.createElement('div'); hud.className = 'atlas-game-hud'; root.querySelector('.atlas-map-shell').appendChild(hud); panel = createPlayPanel({ root: hud, session }); }
}
try {
  if (!fixture) mapData = await loadAstanaMap();
  mount(); unsubscribe = session.subscribe(render);
  $('reduced').checked = context.reducedMotion;
  $('reduced').onchange = event => { context.reducedMotion = event.target.checked; render(); };
  $('hidden').onchange = event => { context.visible = !event.target.checked; render(); };
  $('remount').onclick = mount; $('diagnostics').onclick = diagnostics;
  media.addEventListener('change', event => { context.reducedMotion = event.matches; $('reduced').checked = event.matches; render(); });
  window.akimSceneDev = { get scene() { return scene; }, get snapshot() { return session.getSnapshot(); }, get mapData() { return mapData; }, session, intents, remount: mount };
} catch (error) {
  root.replaceChildren(); const message = document.createElement('div'); message.className = 'atlas-loading';
  const title = document.createElement('strong'); title.textContent = 'Не удалось загрузить карту';
  const detail = document.createElement('p'); detail.textContent = error.message; message.append(title, detail); root.appendChild(message); console.error(error);
}
window.addEventListener('pagehide', () => { unsubscribe?.(); panel?.destroy(); scene?.destroy(); session.destroy(); }, { once: true });
