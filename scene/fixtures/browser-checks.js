import { createScene } from '../index.js';
import { createCamera } from '../camera.js';
import { createWorld } from '../world.js';
import { geography } from './geography.js';
import { assets } from './assets.js';
import { createSnapshot, cityData, demoPreview, demoPresentation } from './snapshot.js';

const root = document.querySelector('#fixture-root');
const output = document.querySelector('#results');
const results = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let snapshot = createSnapshot(), context = { cityData, reducedMotion: false, visible: true };
const intents = [];
let scene = createScene({ root, geography, assets, onIntent: intent => { intents.push(intent); } });
const render = () => scene.update({ snapshot, context });
render();
async function check(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name}: ${error.message}`); }
  output.textContent = results.join('\n');
}
function setPresentation() {
  snapshot = { ...snapshot, planRevision: snapshot.planRevision + 1, result: { valid: true },
    preview: { measures: demoPreview(), score: null, issues: [] }, playback: { status: 'playing', speed: 8 } };
  snapshot.presentation = demoPresentation(snapshot.planRevision); render();
}

await check('Six districts, capped actors, citywide preview excludes Saraishyk', () => {
  snapshot.preview.measures = demoPreview(); render();
  assert(root.querySelectorAll('[data-region]').length === 6, 'six accessible region buttons');
  const d = scene.getDiagnostics(); assert(d.actorCount <= 39, 'actor cap');
  assert(d.effects.markers.length === 6 && d.effects.markers.every(m => m.regionId !== 'saraishyk'), 'city targeting');
});
await check('Preview removal leaves no marker', () => {
  snapshot.preview.measures = []; snapshot.planRevision++; render();
  assert(scene.getDiagnostics().effects.markers.length === 0, 'stale markers');
});
await check('Top/tilted selection still works after zoom and resize', () => {
  for (const projection of ['top', 'tilted']) {
    snapshot.projection = projection; render();
    root.querySelector('[data-action="zoom-in"]').click();
    const stage = root.querySelector('.akim-scene-map'), rect = stage.getBoundingClientRect();
    const state = scene.getDiagnostics().camera;
    const camera = createCamera({ ...state, viewBox: geography.viewBox });
    camera.zoomAt(state.zoom, [state.width / 2, state.height / 2]);
    const position = camera.project(geography.regions.find(r => r.regionId === 'nura').labelAnchor);
    const init = { bubbles: true, pointerId: 999, button: 0, clientX: rect.left + position[0], clientY: rect.top + position[1] };
    // Synthetic pointer cannot capture; temporarily use normal click coordinates via event routing.
    const original = stage.setPointerCapture; stage.setPointerCapture = () => {};
    stage.dispatchEvent(new PointerEvent('pointerdown', init)); stage.dispatchEvent(new PointerEvent('pointerup', init)); stage.setPointerCapture = original;
    assert(intents.at(-1)?.regionId === 'nura', `${projection} picking`);
    root.querySelector('[data-action="reset"]').click();
  }
});
await check('Drag pans and never selects a district', () => {
  const stage = root.querySelector('.akim-scene-map'), rect = stage.getBoundingClientRect(), count = intents.length;
  const before = scene.getDiagnostics().camera.center;
  const init = { bubbles: true, pointerId: 999, button: 0, clientX: rect.left + 150, clientY: rect.top + 150 };
  const original = stage.setPointerCapture; stage.setPointerCapture = () => {};
  stage.dispatchEvent(new PointerEvent('pointerdown', init));
  stage.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: init.clientX + 50 }));
  stage.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: init.clientX + 50 })); stage.setPointerCapture = original;
  assert(!equal(before, scene.getDiagnostics().camera.center), 'camera did not pan');
  assert(intents.length === count, 'drag selected a district');
});
await check('Focused district button survives update; external input unaffected', () => {
  const button = root.querySelector('[data-region="nura"]'); button.focus(); snapshot.focusedRegion = 'nura'; render();
  assert(document.activeElement === button, 'focus lost');
  const input = document.createElement('input'); document.body.appendChild(input); input.focus();
  const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }); input.dispatchEvent(event);
  assert(!event.defaultPrevented, 'external key trapped'); input.remove();
});
await check('Mayor movement stays walkable and cannot change plan', () => {
  snapshot.view = 'district'; snapshot.focusedRegion = 'nura'; render();
  const before = scene.getDiagnostics().mayor.position, original = JSON.stringify(snapshot);
  const stage = root.querySelector('.akim-scene-map'); stage.focus();
  stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  stage.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  const after = scene.getDiagnostics().mayor.position;
  assert(!equal(before, after) && createWorld(geography).walkable.contains(after), 'mayor movement');
  assert(JSON.stringify(snapshot) === original, 'scene mutated snapshot');
});
await check('Repeated snapshots do not starve playback', async () => {
  setPresentation();
  for (let i = 0; i < 10; i++) { await wait(40); render(); }
  assert(scene.getDiagnostics().effects.progress > .02, 'playback starved');
});
await check('Hidden scene releases animation frame and freezes time', async () => {
  context.visible = false; render(); const before = scene.getDiagnostics(); await wait(160);
  const after = scene.getDiagnostics(); assert(!after.running && after.frames === before.frames, 'hidden work');
  assert(after.effects.progress === before.effects.progress, 'hidden timeline'); context.visible = true; render();
});
await check('Pause freezes playback; skip reveals mixed reactions once', async () => {
  snapshot.playback.status = 'paused'; render(); const before = scene.getDiagnostics().effects.progress; await wait(100);
  assert(before === scene.getDiagnostics().effects.progress, 'pause failed');
  snapshot.playback.status = 'complete'; render(); const state = scene.getDiagnostics().effects;
  assert(state.progress === 1 && state.reactions.some(r => r.tone === 'negative'), 'mixed outcome missing');
  const completed = intents.filter(i => i.type === 'PLAYBACK_COMPLETE').length; render();
  assert(intents.filter(i => i.type === 'PLAYBACK_COMPLETE').length === completed, 'duplicate completion');
});
await check('Reduced motion completes same result with no loop', () => {
  const expected = scene.getDiagnostics().effects; context.reducedMotion = true; snapshot.playback.status = 'playing'; render();
  const actual = scene.getDiagnostics(); assert(equal(actual.effects.markers, expected.markers) && equal(actual.effects.reactions, expected.reactions), 'reduced result differs');
  assert(!actual.running, 'reduced loop remains');
});
await check('Normal wheel remains available for page scroll', () => {
  const stage = root.querySelector('.akim-scene-map');
  const event = new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true }); stage.dispatchEvent(event);
  assert(!event.defaultPrevented, 'page scrolling trapped');
});
await check('Destroy/remount has one scene and no stale callback', async () => {
  const old = scene; old.destroy(); old.destroy(); const count = intents.length;
  assert(root.childElementCount === 0 && !old.getDiagnostics().running, 'old scene active');
  snapshot = createSnapshot(); context.reducedMotion = false;
  scene = createScene({ root, geography, assets, onIntent: i => intents.push(i) }); render();
  scene = createScene({ root, geography, assets, onIntent: i => intents.push(i) }); render(); await wait(160);
  assert(root.querySelectorAll('.akim-scene').length === 1, 'duplicate scenes');
  assert(scene.getDiagnostics().actorCount === 15 && intents.length === count, 'duplicate actors/callbacks');
});
await wait(600);
const diagnostic = scene.getDiagnostics();
results.push(`MEASURED ${JSON.stringify({ browser: navigator.userAgent, viewport: [innerWidth, innerHeight], frames: diagnostic.frames,
  averageMotionRenderMs: diagnostic.averageMotionRenderMs, actors: diagnostic.actorCount, overflow: document.documentElement.scrollWidth > innerWidth, missing: diagnostic.missingAssetIds })}`);
output.textContent = results.join('\n') + `\n${results.some(r => r.startsWith('FAIL')) ? 'FAILED' : 'ALL PASS'}`;
document.title = results.some(r => r.startsWith('FAIL')) ? 'FAIL Scene browser checks' : 'PASS Scene browser checks';
