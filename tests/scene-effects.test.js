import test from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, EFFECT_LIMITS } from '../scene/effects.js';
import { createScene } from '../scene/index.js';

const regions = ['esil', 'almaty', 'saryarka', 'baikonur', 'nura'];
const indicators = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'];

function snapshot(overrides = {}) {
  return {
    contractVersion: 1,
    revision: 1,
    planRevision: 4,
    preview: {
      measures: [
        { id: 'M7', scope: 'district', targets: ['Нура'], lag: 3 },
        { id: 'M12', scope: 'city', targets: [], lag: 1 },
      ],
      score: null,
    },
    result: { valid: true, score: 61.23 },
    presentation: {
      planRevision: 4,
      horizon: 8,
      order: ['M7', 'M12'],
      cues: [
        { measureId: 'M12', regionIds: regions, lag: 1, effects: { C2: 4.375 } },
        { measureId: 'M7', regionIds: ['nura'], lag: 3, effects: { S1: 10 } },
      ],
      reactions: [
        { regionId: 'nura', indicator: 'S1', delta: 10, tone: 'positive' },
        { regionId: 'nura', indicator: 'T1', delta: -1.75, tone: 'negative' },
      ],
    },
    playback: { status: 'playing', speed: 1 },
    ...overrides,
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

test('draft markers use explicit district identities, city scope has exactly five model regions', () => {
  const effects = createEffects();
  const state = effects.update({ snapshot: snapshot({ result: null, presentation: null }) });
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.markers.filter((marker) => marker.measureId === 'M12').map((marker) => marker.regionId), regions);
  assert.equal(state.markers.find((marker) => marker.measureId === 'M7').regionId, 'nura');
  assert.ok(state.markers.every((marker) => marker.phase === 'queued' && marker.progress === 0));
  assert.deepEqual(state.reactions, []);
  assert.equal(state.progress, 0);
});

test('preview removal and unassigned/unknown targets leave no stale or fabricated markers', () => {
  const effects = createEffects();
  effects.update({ snapshot: snapshot({ result: null, presentation: null }) });
  const state = effects.update({ snapshot: snapshot({
    planRevision: 5,
    result: null,
    presentation: null,
    preview: { measures: [
      { id: 'M7', scope: 'district', targets: [] },
      { id: 'M8', scope: 'district', targets: ['Сарайшық', 'nura', 'Нура район', 'Нура', 'Нура'] },
    ] },
  }) });
  assert.deepEqual(state.markers.map((marker) => marker.id), ['M8:nura']);
});

test('ordered cues and supplied lags control construction, without intermediate result reactions', () => {
  const effects = createEffects();
  let state = effects.update({ snapshot: snapshot() });
  assert.equal(state.markers[0].measureId, 'M7');
  assert.equal(state.markers[0].phase, 'construction');
  assert.equal(state.markers[1].phase, 'queued');
  state = effects.step(3); // quarter 1.5
  assert.equal(state.quarter, 1.5);
  assert.equal(state.markers[0].progress, 0.5);
  assert.equal(state.markers[0].phase, 'construction');
  assert.equal(state.markers[1].phase, 'active');
  assert.match(state.feedback, /M7: реализуется/);
  assert.match(state.feedback, /M12: введена/);
  assert.deepEqual(state.reactions, []);
});

test('pause, hidden state and idempotent updates preserve timeline; speed changes timing only', () => {
  const effects = createEffects();
  const initial = snapshot();
  effects.update({ snapshot: initial });
  effects.step(4);
  effects.update({ snapshot: initial });
  assert.equal(effects.getState().quarter, 2);
  effects.update({ snapshot: initial, visible: false });
  assert.equal(effects.step(100).quarter, 2);
  effects.update({ snapshot: snapshot({ playback: { status: 'paused', speed: 2 } }) });
  assert.equal(effects.step(100).quarter, 2);
  effects.update({ snapshot: snapshot({ playback: { status: 'playing', speed: 2 } }) });
  assert.equal(effects.step(2).quarter, 4);
  assert.equal(initial.result.score, 61.23);
});

test('normal completion, skip and reduced motion give identical final markers/reactions', () => {
  const results = [];
  for (const mode of ['normal', 'skip', 'reduced', 'paused-reduced']) {
    const completed = [];
    const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
    effects.update({ snapshot: snapshot({ playback: { status: mode === 'skip' ? 'complete' : mode === 'paused-reduced' ? 'paused' : 'playing', speed: 1 } }), reducedMotion: mode.includes('reduced') });
    if (mode === 'normal') effects.step(16);
    effects.step(100);
    assert.deepEqual(completed, [4]);
    const final = effects.getState();
    assert.equal(final.progress, 1);
    assert.equal(final.quarter, 8);
    assert.equal(final.status, 'complete');
    assert.ok(final.markers.every((marker) => marker.phase === 'active' && marker.progress === 1));
    assert.match(final.feedback, /улучшения и ухудшения/);
    results.push(final);
  }
  results.forEach((result) => assert.deepEqual(result, results[0]));
});

test('completion is once per run and replay of the same plan resets and completes once again', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot() });
  effects.step(16);
  effects.update({ snapshot: snapshot() });
  effects.step(100);
  effects.update({ snapshot: snapshot({ playback: { status: 'complete', speed: 1 } }) });
  assert.deepEqual(completed, [4]);
  effects.update({ snapshot: snapshot() });
  assert.equal(effects.getState().quarter, 0);
  assert.equal(effects.getState().status, 'playing');
  assert.deepEqual(effects.getState().reactions, []);
  effects.step(16);
  assert.deepEqual(completed, [4, 4]);
});

test('a new plan cancels old presentation; stale metadata cannot emit completion or reactions', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot() });
  effects.step(12);
  effects.update({ snapshot: snapshot({ planRevision: 5 }) });
  const state = effects.step(100);
  assert.equal(state.status, 'idle');
  assert.equal(state.progress, 0);
  assert.deepEqual(state.reactions, []);
  assert.deepEqual(completed, []);
});

test('synchronous completion callbacks may update to complete without recursive completion', () => {
  let calls = 0;
  const effects = createEffects({ onComplete: (revision) => {
    calls += 1;
    assert.equal(revision, 4);
    assert.equal(effects.getState().status, 'complete');
    effects.update({ snapshot: snapshot({ playback: { status: 'complete', speed: 1 } }) });
  } });
  effects.update({ snapshot: snapshot(), reducedMotion: true });
  assert.equal(calls, 1);
  assert.equal(effects.getState().status, 'complete');
});

test('synchronous completion callbacks may replace the plan without old state overwriting it', () => {
  const effects = createEffects({ onComplete: () => {
    effects.update({ snapshot: snapshot({
      planRevision: 5,
      result: null,
      presentation: null,
      preview: { measures: [] },
      playback: { status: 'idle', speed: 1 },
    }) });
  } });
  effects.update({ snapshot: snapshot() });
  const state = effects.step(16);
  assert.equal(state.progress, 0);
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.markers, []);
});

test('selectors bound duplicate/invalid inputs and exclude the context-only region', () => {
  const effects = createEffects();
  const source = snapshot();
  source.presentation.order = Array.from({ length: 14 }, (_, index) => `M${index + 1}`);
  source.presentation.cues = source.presentation.order.flatMap((measureId) => [
    { measureId, regionIds: [...regions, 'saraishyk', 'nura', 'unknown'], lag: 1 },
    { measureId, regionIds: regions, lag: 1 },
  ]);
  source.presentation.reactions = [
    { regionId: 'saraishyk', indicator: 'T1', delta: 10, tone: 'positive' },
    { regionId: 'nura', indicator: 'T1', delta: NaN, tone: 'positive' },
    { regionId: 'nura', indicator: 'made-up', delta: 10, tone: 'positive' },
    { regionId: 'nura', indicator: 'T1', delta: 10, tone: 'cheering' },
    ...regions.flatMap((regionId) => indicators.flatMap((indicator) => [
      { regionId, indicator, delta: -1, tone: 'negative' },
      { regionId, indicator, delta: 20, tone: 'positive' },
    ])),
  ];
  const state = effects.update({ snapshot: source, reducedMotion: true });
  assert.equal(state.markers.length, EFFECT_LIMITS.maxMarkers);
  assert.equal(new Set(state.markers.map((marker) => marker.id)).size, EFFECT_LIMITS.maxMarkers);
  assert.equal(state.reactions.length, EFFECT_LIMITS.maxReactions);
  assert.ok(state.markers.every((marker) => marker.regionId !== 'saraishyk'));
  assert.ok(state.reactions.every((reaction) => reaction.delta === -1 && reaction.tone === 'negative'));
  assert.match(state.feedback, /ухудшения/);
  assert.doesNotMatch(state.feedback, /улучшения/);
});

test('snapshots stay read only and returned state cannot mutate the controller', () => {
  const source = freezeDeep(snapshot());
  const before = JSON.stringify(source);
  const effects = createEffects();
  const state = effects.update({ snapshot: source, reducedMotion: true });
  state.markers[0].regionId = 'saraishyk';
  state.reactions[0].delta = 900;
  assert.equal(effects.getState().markers[0].regionId, 'nura');
  assert.equal(effects.getState().reactions[0].delta, 10);
  assert.equal(JSON.stringify(source), before);
});

test('invalid outcomes do not animate and destroy permanently releases visible state', () => {
  const completed = [];
  const effects = createEffects({ onComplete: (revision) => completed.push(revision) });
  effects.update({ snapshot: snapshot({ result: { valid: false, score: null } }), reducedMotion: true });
  assert.equal(effects.step(16).status, 'idle');
  effects.update({ snapshot: snapshot() });
  effects.step(4);
  effects.destroy();
  effects.destroy();
  effects.update({ snapshot: snapshot(), reducedMotion: true });
  assert.deepEqual(effects.step(16).markers, []);
  assert.equal(effects.getState().status, 'idle');
  assert.deepEqual(completed, []);
});

test('non-finite or non-positive frame deltas cannot advance or poison the timeline', () => {
  const effects = createEffects();
  effects.update({ snapshot: snapshot() });
  for (const delta of [NaN, Infinity, -1, 0, '10', undefined]) effects.step(delta);
  assert.equal(effects.getState().quarter, 0);
  effects.step(2);
  assert.equal(effects.getState().quarter, 1);
});

// A deliberately small DOM adapter: exercises the real renderer's lifecycle,
// parent/child ownership and event subscriptions without a browser dependency.
function sceneHarness(t) {
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
      allNodes.add(this);
    }
    set className(value) { this.setAttribute('class', value); }
    get className() { return this.attributes.class || ''; }
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
        const parts = query.trim().split(/\s+/).filter(part => part !== '>');
        if (!matches(node, parts.pop())) return false;
        let ancestor = node.parentNode;
        while (parts.length) {
          const part = parts.pop();
          while (ancestor && !matches(ancestor, part)) ancestor = ancestor.parentNode;
          if (!ancestor) return false;
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
    dispatchEvent(event) { for (const callback of [...(this.listeners.get(event.type) || [])]) callback({ target: this, ...event }); }
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
    mount(root, onIntent) {
      const scene = createScene({ root, geography: lifecycleGeography, assets: { assets: [] }, onIntent });
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

const lifecycleGeography = freezeDeep({
  schemaVersion: 1, status: 'fixture', viewBox: [0, 0, 600, 400], sources: [],
  regions: [...regions, 'saraishyk'].map((regionId, index) => {
    const x = index % 3 * 200, y = Math.floor(index / 3) * 200;
    return { regionId, label: regionId, labelAnchor: [x + 100, y + 100],
      polygons: [[[[x, y], [x + 200, y], [x + 200, y + 200], [x, y + 200], [x, y]]]] };
  }),
  paths: [{ id: 'decorative-test-walk', kind: 'walking', illustrative: true,
    points: [[240, 240], [350, 240], [350, 350]], sourceIds: [] }],
});

const sceneSnapshot = (overrides = {}) => freezeDeep(snapshot({
  mode: 'game', view: 'overview', projection: 'top', focusedRegion: null, plan: [], ...overrides,
}));

test('scene repeated updates preserve advancing playback, one frame and a frozen snapshot', t => {
  const harness = sceneHarness(t);
  const scene = harness.mount(harness.root);
  const source = sceneSnapshot();
  const before = JSON.stringify(source);
  scene.update({ snapshot: source, context: {} });
  const listenerCount = harness.listenerCount();
  assert.ok(listenerCount > 0);
  assert.ok(scene.getDiagnostics().actorCount > 0);
  for (let index = 0; index <= 25; index++) {
    scene.update({ snapshot: source, context: {} });
    assert.equal(harness.pendingFrames(), 1);
    assert.equal(harness.listenerCount(), listenerCount);
    harness.frame(index * 40);
  }
  assert.ok(Math.abs(scene.getDiagnostics().effects.quarter - 0.5) < 1e-9);
  assert.equal(harness.pendingFrames(), 1);
  assert.equal(harness.root.children.length, 1);
  assert.equal(JSON.stringify(source), before);
});

test('scene hides without frames and resumes without counting the hidden interval', t => {
  const harness = sceneHarness(t);
  const scene = harness.mount(harness.root);
  const source = sceneSnapshot();
  scene.update({ snapshot: source, context: {} });
  harness.frame(0); harness.frame(40);
  const before = scene.getDiagnostics().effects.quarter;
  harness.document.hidden = true;
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(harness.pendingFrames(), 0);
  harness.frame(10000);
  assert.equal(scene.getDiagnostics().effects.quarter, before);
  assert.equal(scene.getDiagnostics().visible, false);
  harness.document.hidden = false;
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(harness.pendingFrames(), 1);
  harness.frame(10040);
  assert.equal(scene.getDiagnostics().effects.quarter, before);
  harness.frame(10080);
  assert.ok(scene.getDiagnostics().effects.quarter > before);
  scene.update({ snapshot: source, context: { visible: false } });
  assert.equal(harness.pendingFrames(), 0);
  scene.update({ snapshot: sceneSnapshot({ mode: 'calculator', playback: { status: 'complete', speed: 1 } }), context: {} });
  assert.equal(harness.pendingFrames(), 0);
  assert.equal(scene.getDiagnostics().effects.status, 'complete');
});

test('scene remount destroys old actors, container, observers, listeners and frame', t => {
  const harness = sceneHarness(t);
  const first = harness.mount(harness.root);
  first.update({ snapshot: sceneSnapshot(), context: {} });
  const firstContainer = harness.root.children[0];
  const listeners = harness.listenerCount();
  const second = harness.mount(harness.root);
  second.update({ snapshot: sceneSnapshot(), context: {} });
  assert.equal(first.getDiagnostics().destroyed, true);
  assert.equal(first.getDiagnostics().actorCount, 0);
  assert.equal(firstContainer.parentNode, null);
  assert.equal(harness.root.children.length, 1);
  assert.notEqual(harness.root.children[0], firstContainer);
  assert.equal(harness.pendingFrames(), 1);
  assert.equal(harness.activeObservers(), 1);
  assert.equal(harness.listenerCount(), listeners);
  second.destroy(); second.destroy();
  assert.equal(harness.root.children.length, 0);
  assert.equal(harness.pendingFrames(), 0);
  assert.equal(harness.activeObservers(), 0);
  assert.equal(harness.listenerCount(), 0);
  second.update({ snapshot: sceneSnapshot(), context: {} });
  harness.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(harness.pendingFrames(), 0);
});

test('scene reduced-motion completion allows synchronous update, emits once and owns no frame', t => {
  const harness = sceneHarness(t);
  const intents = [];
  const source = sceneSnapshot();
  const before = JSON.stringify(source);
  let scene;
  scene = harness.mount(harness.root, intent => {
    intents.push(intent);
    scene.update({ snapshot: sceneSnapshot({ playback: { status: 'complete', speed: 1 } }), context: { reducedMotion: true } });
  });
  scene.update({ snapshot: source, context: { reducedMotion: true } });
  assert.deepEqual(intents, [{ type: 'PLAYBACK_COMPLETE', planRevision: 4 }]);
  assert.equal(scene.getDiagnostics().effects.progress, 1);
  assert.equal(harness.pendingFrames(), 0);
  assert.equal(JSON.stringify(source), before);
});
