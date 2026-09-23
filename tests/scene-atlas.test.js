import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene } from '../scene/index.js';
import { readFileSync } from 'node:fs';
import { createGeoData } from '../scene/geodata.js';
import { pointInRegion } from '../scene/camera.js';

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

// Synthetic geometry isolates renderer behavior from network and source revisions.
const square = (x, y, size) => [[[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]]];
const atlasData = freezeDeep({
  viewBox: [0, 0, 1000, 700], bounds: [71.3, 51.0, 71.7, 51.3], center: [500, 350],
  landmarks: [
    { id: 'baiterek', label: 'Бәйтерек', category: 'landmark', importance: 10, position: [500, 350], coordinates: [71.4304, 51.1282] },
    { id: 'akorda', label: 'Ақорда', category: 'government', importance: 8, position: [535, 370], coordinates: [71.4460, 51.1250] },
  ],
  parkAnchors: [{ id: 'park', label: 'Парк', category: 'park_anchor', importance: 5, position: [465, 325], coordinates: [71.41, 51.14] }],
  roads: [{ id: 'road-1', kind: 'primary', importance: 5, points: [[400, 330], [450, 340], [500, 355], [550, 380], [600, 410]] }],
  buildings: [{ id: 'building-1', polygons: square(510, 320, 8) }],
  landscape: [{ id: 'water-1', kind: 'water', polygons: square(560, 300, 12) }, { id: 'park-1', kind: 'park', polygons: square(455, 315, 18) }],
  corridors: [{ id: 'corridor-1', road: 'Проспект', roadIds: ['road-1'], importance: 0.7 }],
  regions: [{ regionId: 'esil', status: 'historical', labelAnchor: [500, 350], polygons: square(0, 0, 1000) }],
});
const sceneSnapshot = (overrides = {}) => freezeDeep({
  contractVersion: 1, revision: 1, planRevision: 4, mode: 'game', view: 'overview', projection: 'top', focusedRegion: null,
  plan: [], preview: { measures: [{ id: 'M7', scope: 'district', targets: ['Нура'], lag: 3 }], score: null },
  result: { valid: true, score: 61.23 },
  presentation: { planRevision: 4, horizon: 8, order: ['M7'], cues: [{ measureId: 'M7', regionIds: ['nura'], lag: 3, effects: { S1: 10 } }], reactions: [] },
  playback: { status: 'playing', speed: 1 }, ...overrides,
});

// A deliberately small DOM adapter: exercises the real renderer's lifecycle,
// parent/child ownership and event subscriptions without a browser dependency.
function atlasHarness(t) {
  const allNodes = new Set();
  const observers = new Set();
  const callbacks = new Map();
  const scenes = new Set();
  let sequence = 0;
  const matches = (node, selector) => {
    if (selector.startsWith('.')) return (node.attributes.class || '').split(/\s+/).includes(selector.slice(1));
    const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attribute) return attribute[1] in node.attributes
      && (attribute[2] === undefined || node.attributes[attribute[1]] === attribute[2]);
    return node.tagName === selector.toLowerCase();
  };
  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName;
      this.parentNode = null;
      this.children = [];
      this.attributes = {};
      this.style = {};
      this.dataset = {};
      this.listeners = new Map();
      this.capturedPointers = new Set();
      this._text = '';
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        toggle: (value, force) => {
          const names = new Set(this.className.split(/\s+/).filter(Boolean));
          const enabled = force ?? !names.has(value);
          if (enabled) names.add(value); else names.delete(value);
          this.className = [...names].join(' ');
          return enabled;
        },
      };
      allNodes.add(this);
    }
    set className(value) { this.setAttribute('class', value); }
    get className() { return this.attributes.class || ''; }
    set hidden(value) { if (value) this.attributes.hidden = ''; else delete this.attributes.hidden; }
    get hidden() { return 'hidden' in this.attributes; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    get lastElementChild() { return this.children.at(-1) || null; }
    set innerHTML(html) {
      this.replaceChildren();
      const stack = [this];
      for (const match of html.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)) {
        if (match[1]) { if (stack.length > 1) stack.pop(); continue; }
        const child = new Element(match[2].toLowerCase());
        for (const attribute of match[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
          child.setAttribute(attribute[1], attribute[2] ?? '');
        }
        stack.at(-1).appendChild(child);
        if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(child.tagName) && !match[3].endsWith('/')) stack.push(child);
      }
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; return child; }
    replaceChildren(...children) { this.children.slice().forEach(child => child.remove()); children.forEach(child => this.appendChild(child)); }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    }
    replaceWith(node) {
      const parent = this.parentNode;
      if (!parent) return;
      const index = parent.children.indexOf(this);
      node.remove(); parent.children[index] = node; node.parentNode = parent; this.parentNode = null;
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    closest(selector) { return matches(this, selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) {
      const descendants = [];
      const visit = node => { for (const child of node.children) { descendants.push(child); visit(child); } };
      visit(this);
      return descendants.filter(node => selector.split(',').some(query => {
        const parts = query.trim().replace(/\s*>\s*/g, '>').split(/(>|\s+)/).filter(Boolean);
        if (!matches(node, parts.pop())) return false;
        let ancestor = node.parentNode;
        while (parts.length) {
          const relation = parts.pop();
          const part = parts.pop();
          if (relation !== '>') while (ancestor && !matches(ancestor, part)) ancestor = ancestor.parentNode;
          if (!ancestor || !matches(ancestor, part)) return false;
          ancestor = ancestor.parentNode;
        }
        return true;
      }));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
    }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    dispatchEvent(event) {
      const input = { target: this, button: 0, pointerId: 1, clientX: 450, clientY: 300,
        ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
        defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...event };
      for (const callback of [...(this.listeners.get(input.type) || [])]) callback(input);
      return input;
    }
    getBoundingClientRect() { return { width: 900, height: 600, left: 0, top: 0 }; }
    focus() { document.activeElement = this; }
    setPointerCapture(id) { this.capturedPointers.add(id); }
    hasPointerCapture(id) { return this.capturedPointers.has(id); }
    releasePointerCapture(id) { this.capturedPointers.delete(id); }
  }
  const document = Object.assign(new Element('document'), {
    hidden: false,
    createElement: tag => new Element(tag),
    createElementNS: (_namespace, tag) => new Element(tag),
  });
  const globals = {
    document,
    window: new Element('window'),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observers.add(this); }
      observe(node) { this.targets.add(node); }
      disconnect() { this.targets.clear(); }
    },
    requestAnimationFrame: callback => { callbacks.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => callbacks.delete(id),
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    scenes.forEach(scene => scene.destroy());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    document,
    root: new Element('main'),
    mount(root, onIntent, mapData = atlasData) {
      const scene = createScene({ root, mapData, onIntent });
      scenes.add(scene); return scene;
    },
    frame(time) {
      const current = [...callbacks.values()]; callbacks.clear();
      current.forEach(callback => callback(time));
    },
    pendingFrames: () => callbacks.size,
    activeObservers: () => [...observers].filter(observer => observer.targets.size > 0).length,
    listenerCount: () => [...allNodes].reduce((sum, node) => sum + [...node.listeners.values()].reduce((count, handlers) => count + handlers.size, 0), 0),
  };
}


test('atlas optional mapData mounts supplied geometry without inventing current district picks', t => {
  const harness = atlasHarness(t), intents = [];
  const scene = harness.mount(harness.root, intent => intents.push(intent));
  scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
  const stage = harness.root.querySelector('.atlas-stage');
  assert.deepEqual(scene.getDiagnostics().data, { roads: 1, buildings: 1, landmarks: 2, regions: 0 });
  assert.equal(harness.root.querySelectorAll('[data-road-id]').length, 1);
  assert.equal(harness.root.querySelectorAll('[data-district]').length, 0);
  stage.dispatchEvent({ type: 'pointerdown' });
  stage.dispatchEvent({ type: 'pointerup' });
  assert.equal(intents.filter(intent => intent.type === 'FOCUS_REGION').length, 0);
  assert.equal(scene.getDiagnostics().mayor, null);
  assert.equal(harness.root.querySelector('.atlas-sidebar'), null);
  assert.equal(harness.root.querySelector('.atlas-search'), null);
  assert.ok(harness.root.querySelector('[data-act="sources"]'));
  assert.equal(harness.root.querySelector('.atlas-place-card').hidden, true);
});

test('atlas generated mayor and vehicles retain image nodes while moving', t => {
  const harness = atlasHarness(t);
  const mapData = freezeDeep({ ...atlasData, regions: [{ regionId: 'nura', status: 'verified', labelAnchor: [500, 350], polygons: square(0, 0, 1000) }] });
  const scene = harness.mount(harness.root, undefined, mapData);
  scene.update({ snapshot: sceneSnapshot({ view: 'district', focusedRegion: 'nura' }), context: { reducedMotion: false } });
  const mayor = harness.root.querySelector('[data-art-id="mayor"]');
  const image = mayor.querySelector('image');
  assert.match(image.getAttribute('href'), /assets\/exports\/characters\/mayor-still\.png$/);
  const before = mayor.getAttribute('transform');
  const stage = harness.root.querySelector('.atlas-stage');
  stage.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  stage.dispatchEvent({ type: 'keyup', key: 'ArrowRight' });
  harness.frame(0); harness.frame(40);
  assert.equal(harness.root.querySelector('[data-art-id="mayor"]'), mayor);
  assert.equal(mayor.querySelector('image'), image);
  assert.notEqual(mayor.getAttribute('transform'), before);
  assert.ok(scene.getDiagnostics().artNodeCount < 100);
});

test('atlas accepted current boundaries are pickable while historical overlaps remain excluded', t => {
  const harness = atlasHarness(t), intents = [];
  const current = { regionId: 'nura', status: 'verified', labelAnchor: [500, 350], polygons: square(0, 0, 1000) };
  const mapData = freezeDeep({ ...atlasData, regions: [...atlasData.regions, current] });
  const scene = harness.mount(harness.root, intent => intents.push(intent), mapData);
  scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
  const stage = harness.root.querySelector('.atlas-stage');
  stage.dispatchEvent({ type: 'pointerdown' }); stage.dispatchEvent({ type: 'pointerup' });
  assert.deepEqual(intents.filter(intent => intent.type === 'FOCUS_REGION'), [{ type: 'FOCUS_REGION', regionId: 'nura' }]);
  assert.equal(scene.getDiagnostics().data.regions, 1);
  assert.equal(harness.root.querySelector('[data-district="esil"]'), null);
  assert.ok(harness.root.querySelector('[data-district="nura"]'));
});

test('atlas identical updates keep one frame, listeners and continuously advancing playback', t => {
  const harness = atlasHarness(t), scene = harness.mount(harness.root);
  const source = sceneSnapshot(), before = JSON.stringify(source);
  scene.update({ snapshot: source });
  const listeners = harness.listenerCount();
  assert.ok(scene.getDiagnostics().actorCount > 0);
  for (let i = 0; i <= 25; i++) {
    scene.update({ snapshot: source });
    assert.equal(harness.pendingFrames(), 1);
    assert.equal(harness.listenerCount(), listeners);
    harness.frame(i * 40);
  }
  assert.ok(Math.abs(scene.getDiagnostics().effects.quarter - 0.5) < 1e-9);
  assert.equal(harness.root.children.length, 1);
  assert.equal(JSON.stringify(source), before);
});

test('atlas playback keeps elapsed time when map rendering delays a frame', t => {
  const harness = atlasHarness(t), scene = harness.mount(harness.root);
  scene.update({ snapshot: sceneSnapshot() });
  harness.frame(0);
  harness.frame(500);
  assert.equal(scene.getDiagnostics().effects.quarter, 0.25);
});

test('atlas focuses newly assigned district once while preserving manual pan, city edits and walking', t => {
  const harness = atlasHarness(t);
  const regions = [
    { regionId: 'almaty', status: 'verified', labelAnchor: [800, 500], polygons: square(700, 400, 200) },
    { regionId: 'nura', status: 'verified', labelAnchor: [200, 400], polygons: square(100, 300, 200) },
  ];
  const scene = harness.mount(harness.root, undefined, { ...atlasData, regions });
  const update = (planRevision, plan, overrides = {}) => scene.update({ snapshot: sceneSnapshot({ planRevision, plan, ...overrides }), context: { reducedMotion: true } });
  update(1, [{ id: 'M7', district: 'Алматы' }]);
  assert.deepEqual(scene.getDiagnostics().camera.center, atlasData.center, 'initial restored plan must not steal initial view');
  update(2, [{ id: 'M7', district: 'Алматы' }, { id: 'M4', district: 'Нура' }]);
  assert.deepEqual(scene.getDiagnostics().camera.center, [200, 400]);
  const stage = harness.root.querySelector('.atlas-stage');
  stage.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  const panned = scene.getDiagnostics().camera;
  update(2, [{ id: 'M7', district: 'Алматы' }, { id: 'M4', district: 'Нура' }], { revision: 99 });
  assert.deepEqual(scene.getDiagnostics().camera, panned, 'unrelated update preserves player pan');
  update(3, [{ id: 'M7', district: 'Алматы' }, { id: 'M4', district: 'Нура' }, { id: 'M12', district: null }]);
  assert.deepEqual(scene.getDiagnostics().camera, panned, 'city policy does not move camera');
  update(4, [{ id: 'M4', district: 'Нура' }]);
  assert.deepEqual(scene.getDiagnostics().camera, panned, 'removal does not move camera');
  update(5, [{ id: 'M4', district: 'Алматы' }]);
  assert.deepEqual(scene.getDiagnostics().camera.center, [800, 500], 'reassignment follows new district');
  update(5, [{ id: 'M4', district: 'Алматы' }], { view: 'district', focusedRegion: 'nura' });
  const walkCamera = scene.getDiagnostics().camera;
  update(6, [{ id: 'M4', district: 'Алматы' }, { id: 'M8', district: 'Алматы' }], { view: 'district', focusedRegion: 'nura' });
  assert.deepEqual(scene.getDiagnostics().camera, walkCamera, 'walking view takes precedence');
});

test('atlas calculator mode cancels drag capture and cannot pan until shown again', t => {
  const harness = atlasHarness(t), scene = harness.mount(harness.root);
  scene.update({ snapshot: sceneSnapshot() });
  const stage = harness.root.querySelector('.atlas-stage');
  stage.dispatchEvent({ type: 'pointerdown', pointerId: 7 });
  assert.equal(stage.hasPointerCapture(7), true);
  scene.update({ snapshot: sceneSnapshot({ mode: 'calculator' }) });
  assert.equal(harness.pendingFrames(), 0);
  assert.equal(stage.hasPointerCapture(7), false);
  assert.equal(scene.getDiagnostics().visible, false);
  const camera = scene.getDiagnostics().camera;
  stage.dispatchEvent({ type: 'pointermove', pointerId: 7, clientX: 700 });
  stage.dispatchEvent({ type: 'wheel', ctrlKey: true, deltaY: -100 });
  stage.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  assert.deepEqual(scene.getDiagnostics().camera, camera);
  scene.update({ snapshot: sceneSnapshot() });
  assert.equal(scene.getDiagnostics().visible, true);
  assert.equal(harness.pendingFrames(), 1);
});

test('atlas visibility pauses timeline and releases drag without counting hidden time', t => {
  const harness = atlasHarness(t), scene = harness.mount(harness.root);
  scene.update({ snapshot: sceneSnapshot() });
  const stage = harness.root.querySelector('.atlas-stage');
  harness.frame(0); harness.frame(40);
  const quarter = scene.getDiagnostics().effects.quarter;
  stage.dispatchEvent({ type: 'pointerdown', pointerId: 8 });
  harness.document.hidden = true;
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(stage.hasPointerCapture(8), false);
  assert.equal(harness.pendingFrames(), 0);
  harness.frame(10000);
  assert.equal(scene.getDiagnostics().effects.quarter, quarter);
  harness.document.hidden = false;
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(harness.pendingFrames(), 1);
  harness.frame(10040);
  assert.equal(scene.getDiagnostics().effects.quarter, quarter);
  harness.frame(10080);
  assert.ok(scene.getDiagnostics().effects.quarter > quarter);
});

test('atlas remount and repeated destroy release old listeners, observers, captures and frames', t => {
  const harness = atlasHarness(t), first = harness.mount(harness.root);
  first.update({ snapshot: sceneSnapshot() });
  const oldContainer = harness.root.children[0], oldStage = oldContainer.querySelector('.atlas-stage');
  const listeners = harness.listenerCount();
  oldStage.dispatchEvent({ type: 'pointerdown', pointerId: 9 });
  const second = harness.mount(harness.root);
  second.update({ snapshot: sceneSnapshot() });
  assert.equal(first.getDiagnostics().destroyed, true);
  assert.equal(oldStage.hasPointerCapture(9), false);
  assert.equal(oldContainer.parentNode, null);
  assert.equal(harness.root.children.length, 1);
  assert.equal(harness.listenerCount(), listeners);
  assert.equal(harness.activeObservers(), 1);
  assert.equal(harness.pendingFrames(), 1);
  second.destroy(); second.destroy();
  assert.equal(harness.root.children.length, 0);
  assert.equal(harness.listenerCount(), 0);
  assert.equal(harness.activeObservers(), 0);
  assert.equal(harness.pendingFrames(), 0);
  second.update({ snapshot: sceneSnapshot() });
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(harness.pendingFrames(), 0);
});

test('atlas keyboard inspects supplied landmarks and missing Nura geography stays non-walkable', t => {
  const harness = atlasHarness(t), intents = [];
  const scene = harness.mount(harness.root, intent => intents.push(intent));
  scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
  const container = harness.root.children[0], stage = container.querySelector('.atlas-stage');
  const landmark = container.querySelector('[data-feature-id="akorda"]');
  assert.ok(landmark);
  const activation = stage.dispatchEvent({ type: 'keydown', key: 'Enter', target: landmark });
  assert.equal(activation.defaultPrevented, true);
  assert.equal(scene.getDiagnostics().selected, 'akorda');
  assert.equal(harness.document.activeElement, stage);
  const before = scene.getDiagnostics().camera;
  stage.dispatchEvent({ type: 'keydown', key: '+' });
  assert.ok(scene.getDiagnostics().camera.zoom > before.zoom);
  const walk = container.querySelector('[data-act="walk"]');
  assert.ok(walk);
  container.dispatchEvent({ type: 'click', target: walk });
  assert.equal(intents.filter(intent => intent.type === 'SET_VIEW').length, 0);
  scene.update({ snapshot: sceneSnapshot({ view: 'district', focusedRegion: 'nura' }), context: { reducedMotion: true } });
  assert.equal(scene.getDiagnostics().mayor, null);
  assert.equal(harness.pendingFrames(), 0);
  assert.equal(container.querySelector('.atlas-layer-mayor').children.length, 0);
});

test('atlas reduced motion completion supports reentrant host updates and emits only once', t => {
  const harness = atlasHarness(t), intents = [];
  let scene;
  scene = harness.mount(harness.root, intent => {
    intents.push(intent);
    scene.update({ snapshot: sceneSnapshot({ playback: { status: 'complete', speed: 1 } }), context: { reducedMotion: true } });
  });
  scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
  assert.equal(intents.length, 1);
  assert.equal(intents[0].type, 'PLAYBACK_COMPLETE');
  assert.equal(intents[0].planRevision, 4);
  assert.equal(scene.getDiagnostics().effects.progress, 1);
  assert.equal(harness.pendingFrames(), 0);
});

test('atlas reduced-motion keyboard tap immediately paints the moved mayor', t => {
  const harness = atlasHarness(t);
  const mapData = freezeDeep({ ...atlasData, regions: [{ regionId: 'nura', status: 'verified', labelAnchor: [500, 350], polygons: square(0, 0, 1000) }] });
  const scene = harness.mount(harness.root, undefined, mapData);
  scene.update({ snapshot: sceneSnapshot({ view: 'district', focusedRegion: 'nura' }), context: { reducedMotion: true } });
  const stage = harness.root.querySelector('.atlas-stage');
  const layer = harness.root.querySelector('.atlas-layer-mayor');
  const beforePosition = scene.getDiagnostics().mayor;
  const beforeTransform = layer.children[0].getAttribute('transform');
  stage.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  stage.dispatchEvent({ type: 'keyup', key: 'ArrowRight' });
  harness.frame(0);
  assert.ok(scene.getDiagnostics().mayor[0] > beforePosition[0]);
  assert.notEqual(layer.children[0].getAttribute('transform'), beforeTransform);
  assert.equal(harness.pendingFrames(), 0);
});

test('atlas mayor cannot cross a source footprint thinner than a movement sample', t => {
  const harness = atlasHarness(t);
  const mapData = freezeDeep({ ...atlasData,
    regions: [{ regionId: 'nura', status: 'verified', labelAnchor: [500, 350], polygons: square(0, 0, 1000) }],
    buildings: [{ id: 'thin-building', polygons: [[[[465.005, 324], [465.01, 324], [465.01, 326], [465.005, 326], [465.005, 324]]]] }],
  });
  const scene = harness.mount(harness.root, undefined, mapData);
  scene.update({ snapshot: sceneSnapshot({ view: 'district', focusedRegion: 'nura' }), context: { reducedMotion: true } });
  assert.deepEqual(scene.getDiagnostics().mayor, [465, 325]);
  harness.root.querySelector('.atlas-stage').dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  assert.ok(scene.getDiagnostics().mayor[0] < 465.005, 'the whole travelled segment must be clear of footprints');
});

test('atlas walk controls and physical Cyrillic-layout WASD move the mayor and disable outside walking mode', t => {
  const harness = atlasHarness(t);
  const scene = harness.mount(harness.root, undefined, { ...atlasData,
    regions: [{ regionId: 'nura', status: 'verified', labelAnchor: [500, 350], polygons: square(0, 0, 1000) }],
  });
  const walking = sceneSnapshot({ view: 'district', focusedRegion: 'nura' });
  scene.update({ snapshot: walking, context: { reducedMotion: true } });
  const stage = harness.root.querySelector('.atlas-stage');
  const controls = harness.root.querySelector('.atlas-walk-controls');
  assert.equal(controls.hidden, false);
  assert.equal(harness.document.activeElement, stage);
  const beforeKeyboard = scene.getDiagnostics().mayor[0];
  stage.dispatchEvent({ type: 'keydown', key: 'в', code: 'KeyD' });
  stage.dispatchEvent({ type: 'keyup', key: 'в', code: 'KeyD' });
  assert.ok(scene.getDiagnostics().mayor[0] > beforeKeyboard);
  const right = controls.children.find(button => button.dataset.walkKey === 'ArrowRight');
  const beforeTouch = scene.getDiagnostics().mayor[0];
  right.dispatchEvent({ type: 'pointerdown', pointerId: 42 });
  right.dispatchEvent({ type: 'pointerup', pointerId: 42 });
  assert.ok(scene.getDiagnostics().mayor[0] > beforeTouch);
  assert.equal(right.hasPointerCapture(42), false);
  scene.update({ snapshot: sceneSnapshot({ mode: 'calculator' }), context: { reducedMotion: true } });
  assert.equal(controls.hidden, true);
  const after = scene.getDiagnostics().mayor;
  right.dispatchEvent({ type: 'pointerdown', pointerId: 43 });
  assert.deepEqual(scene.getDiagnostics().mayor, after);
});

test('atlas six-source gate accepts the complete set without admitting historical extras', t => {
  const harness = atlasHarness(t);
  const regions = ['esil', 'almaty', 'saryarka', 'baikonur', 'nura', 'saraishyk'].map(regionId => ({
    regionId, status: 'unverified', sourceIds: ['astana-municipal-six-districts'],
    labelAnchor: [500, 350], polygons: square(0, 0, 1000),
  }));
  for (const invalid of [regions.slice(0, 5), regions.map(r => r.regionId === 'nura' ? { ...r, status: 'historical' } : r)]) {
    const scene = harness.mount(harness.root, undefined, { ...atlasData, regions: invalid });
    scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
    assert.equal(scene.getDiagnostics().data.regions, 0);
    assert.equal(scene.getDiagnostics().mayor, null);
    scene.destroy();
  }
  const extras = [...atlasData.regions, { ...regions[1], sourceIds: ['unrelated-source'] }];
  const scene = harness.mount(harness.root, undefined, { ...atlasData, regions: [...extras, ...regions] });
  scene.update({ snapshot: sceneSnapshot(), context: { reducedMotion: true } });
  assert.equal(scene.getDiagnostics().data.regions, 6);
  assert.equal(harness.root.querySelectorAll('[data-district="esil"]').length, 1);
  assert.ok(scene.getDiagnostics().mayor);
});

test('bundled Astana geography adapts all six attributed districts and gives Nura a clear walkable start', t => {
  const files = { seed: 'astana-ai.json', landmarks: 'landmarks.geojson', parks: 'parks.geojson', roads: 'roads.geojson',
    intersections: 'intersections.geojson', landscape: 'landscape-render.geojson', buildings: 'buildings-render.geojson',
    trafficCorridors: 'traffic_corridors.json', majorRoads: 'major_roads.json', districts: 'districts-current.geojson' };
  const input = Object.fromEntries(Object.entries(files).map(([key, filename]) =>
    [key, JSON.parse(readFileSync(new URL(`../scene/data/astana/${filename}`, import.meta.url), 'utf8'))]));
  const mapData = createGeoData(input);
  assert.deepEqual(mapData.regions.map(r => r.regionId).sort(), ['almaty', 'baikonur', 'esil', 'nura', 'saraishyk', 'saryarka']);
  assert.ok(mapData.regions.every(r => r.status === 'unverified' && r.sourceIds.includes('astana-municipal-six-districts')));
  const harness = atlasHarness(t), scene = harness.mount(harness.root, undefined, mapData);
  scene.update({ snapshot: sceneSnapshot({ view: 'district', focusedRegion: 'nura' }), context: { reducedMotion: true } });
  assert.equal(scene.getDiagnostics().data.regions, 6);
  const nura = mapData.regions.find(r => r.regionId === 'nura');
  const exclusions = [...mapData.buildings, ...mapData.landscape.filter(f => /water|river|hydro/.test(f.kind))];
  const stage = harness.root.querySelector('.atlas-stage');
  const start = scene.getDiagnostics().mayor;
  assert.ok(start, 'real Nura geography must support the advertised walking mode');
  let moved = false;
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    stage.dispatchEvent({ type: 'keydown', key }); stage.dispatchEvent({ type: 'keyup', key });
    const position = scene.getDiagnostics().mayor;
    assert.ok(pointInRegion(position, nura));
    assert.equal(exclusions.some(f => pointInRegion(position, f)), false);
    moved ||= position.some((value, axis) => value !== start[axis]);
  }
  assert.equal(moved, true);
});
