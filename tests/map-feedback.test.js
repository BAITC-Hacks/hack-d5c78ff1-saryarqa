import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapFeedback } from '../scene/map-feedback.js';

function dom(t) {
  let created = 0;
  const previous = globalThis.document;
  const doc = { createElementNS(_namespace, tag) {
    created++;
    return { tag, attributes: {}, children: [], parentNode: null, ownerDocument: doc, textContent: '',
      setAttribute(key, value) { this.attributes[key] = String(value); },
      getAttribute(key) { return this.attributes[key] ?? null; },
      appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; },
      remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
        this.parentNode = null;
      },
    };
  } };
  globalThis.document = doc;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  return { layer: doc.createElementNS('', 'svg'), count: () => created };
}
function descendants(node) { return node.children.flatMap((child) => [child, ...descendants(child)]); }
const find = (node, key, value) => descendants(node).find((child) => child.attributes[key] === value);
const byClass = (node, name) => descendants(node).find((child) => (child.attributes.class ?? '').split(' ').includes(name));
const serialize = (node) => JSON.stringify(node, (key, value) => ['parentNode', 'ownerDocument'].includes(key) ? undefined : value);
const regions = [
  { regionId: 'nura', label: 'Нура', labelAnchor: [200, 200] },
  { regionId: 'esil', label: 'Есиль', labelAnchor: [500, 300] },
  { regionId: 'saraishyk', label: 'Сарайшық', labelAnchor: [700, 200] },
];
const camera = { project: (point) => [...point] };
const measure = (id, phase = 'preview', progress = 1) => ({ id, phase, progress });
const state = (measures, effects = {}, mode = 'preview', regionId = 'nura') => ({ mode,
  regions: [{ regionId, measures, effects }, { regionId: 'saraishyk', measures: [], effects: {} }] });
const args = (visualState, overrides = {}) => ({ camera, width: 1000, height: 700, seconds: 0, visualState, ...overrides });

test('feedback reuses policy nodes and removes removed measures and reassigned region subtrees', (t) => {
  const { layer, count } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  feedback.render(args(state([measure('M4'), measure('M7')], { E1: 9 })));
  const first = find(layer, 'data-measure', 'M4');
  const removed = find(layer, 'data-measure', 'M7');
  const created = count();
  feedback.render(args(state([measure('M4'), measure('M7')], { E1: 9 }), { seconds: 2 }));
  assert.equal(find(layer, 'data-measure', 'M4'), first);
  assert.equal(count(), created);
  feedback.render(args(state([measure('M4')], { E1: 9 })));
  assert.equal(find(layer, 'data-measure', 'M4'), first);
  assert.equal(removed.parentNode, null);
  const oldRegion = find(layer, 'data-feedback-region', 'nura');
  feedback.render(args(state([measure('M4')], { E1: 9 }, 'preview', 'esil')));
  assert.equal(oldRegion.parentNode, null);
  assert.equal(find(layer, 'data-feedback-region', 'nura'), undefined);
  assert.equal(feedback.getDiagnostics().regions, 1);
  assert.equal(feedback.getDiagnostics().measures, 1);
});

test('supplied clock drives motion, identical time freezes it, and reduced motion is static', (t) => {
  const { layer, count } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  const visualState = state([measure('M5')], { E2: 8.75 });
  feedback.render(args(visualState, { seconds: 0 }));
  const wind = byClass(layer, 'map-feedback-wind');
  const start = wind.getAttribute('transform');
  feedback.render(args(visualState, { seconds: 2 }));
  assert.notEqual(wind.getAttribute('transform'), start);
  const frozen = serialize(layer);
  feedback.render(args(visualState, { seconds: 2 }));
  assert.equal(serialize(layer), frozen);
  feedback.render(args(visualState, { seconds: 2, reducedMotion: true }));
  const reduced = serialize(layer), created = count();
  feedback.render(args(visualState, { seconds: 200, reducedMotion: true }));
  assert.equal(serialize(layer), reduced);
  assert.equal(count(), created);
});

test('preview and confirmed scenario labels remain distinct as the same nodes update', (t) => {
  const { layer } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  feedback.render(args(state([measure('M7')], { S1: 10 })));
  const policy = find(layer, 'data-measure', 'M7');
  assert.match(byClass(layer, 'map-feedback-caption').textContent, /Предпросмотр/);
  assert.match(descendants(policy).find((child) => child.tag === 'title').textContent, /Предпросмотр.*иллюстрация/);
  feedback.render(args(state([measure('M7', 'active')], { S1: 10 }, 'result')));
  assert.equal(find(layer, 'data-measure', 'M7'), policy);
  assert.match(byClass(layer, 'map-feedback-caption').textContent, /Сценарий/);
  assert.doesNotMatch(byClass(layer, 'map-feedback-caption').textContent, /Предпросмотр/);
  assert.match(descendants(policy).find((child) => child.tag === 'title').textContent, /Сценарий.*иллюстрация/);
});

test('generated policy artwork degrades to vector fallback and remembers failed assets', (t) => {
  const { layer, count } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  const visualState = state([measure('M7')], { S1: 10 });
  feedback.render(args(visualState));
  const image = find(layer, 'data-policy-art', 'M7');
  assert.ok(image && typeof image.onerror === 'function');
  const href = image.getAttribute('href'), drawing = image.parentNode;
  const created = count();
  image.onerror();
  assert.equal(image.parentNode, null);
  assert.ok(count() > created);
  assert.ok(descendants(drawing).some((child) => child.tag === 'rect'));
  assert.ok(feedback.getDiagnostics().missingAssetIds.includes(href));
  feedback.render(args({ mode: 'baseline', regions: [] }));
  feedback.render(args(visualState));
  assert.equal(find(layer, 'data-policy-art', 'M7'), undefined);
  assert.equal(feedback.getDiagnostics().measures, 1);
});

test('late artwork failures cannot allocate nodes after removal or destroy, and cleanup is idempotent', (t) => {
  const { layer, count } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  feedback.render(args(state([measure('M7')])));
  const removedImage = find(layer, 'data-policy-art', 'M7');
  const removedHandler = removedImage.onerror;
  feedback.render(args({ mode: 'baseline', regions: [] }));
  const afterRemove = count();
  removedHandler();
  assert.equal(count(), afterRemove);
  feedback.render(args(state([measure('M8')])));
  const destroyedHandler = find(layer, 'data-policy-art', 'M8').onerror;
  feedback.destroy(); feedback.destroy();
  const afterDestroy = count();
  destroyedHandler();
  feedback.render(args(state([measure('M4')])));
  assert.equal(count(), afterDestroy);
  assert.equal(layer.children.length, 0);
  assert.equal(feedback.getDiagnostics().destroyed, true);
  assert.equal(feedback.getDiagnostics().regions, 0);
});

test('negative air changes and pending construction do not show clean-air benefits', (t) => {
  const { layer } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  feedback.render(args(state([measure('M5', 'active')], { E2: -2 }, 'result')));
  assert.equal(byClass(layer, 'map-feedback-wind').getAttribute('opacity'), '0');
  assert.equal(byClass(layer, 'map-feedback-haze').getAttribute('opacity'), '0');
  assert.notEqual(byClass(layer, 'map-feedback-tradeoff').getAttribute('display'), 'none');
  feedback.render(args(state([measure('M5', 'construction', 0.4)], {}, 'result')));
  assert.equal(byClass(layer, 'map-feedback-wind').getAttribute('opacity'), '0');
  feedback.render(args(state([measure('M5', 'active')], { E2: 8.75 }, 'result')));
  assert.ok(Number(byClass(layer, 'map-feedback-wind').getAttribute('opacity')) > 0);
  assert.equal(byClass(layer, 'map-feedback-tradeoff').getAttribute('display'), 'none');
});

test('empty reference descriptors render no effects and baseline removes previous feedback', (t) => {
  const { layer } = dom(t);
  const feedback = createMapFeedback({ layer, regions });
  feedback.render(args(state([measure('M12')], { C2: 4.375 })));
  assert.equal(find(layer, 'data-feedback-region', 'saraishyk'), undefined);
  assert.equal(feedback.getDiagnostics().regions, 1);
  feedback.render(args({ mode: 'baseline', regions: [] }));
  assert.equal(feedback.getDiagnostics().regions, 0);
  assert.equal(feedback.getDiagnostics().measures, 0);
  assert.equal(find(layer, 'data-measure', 'M12'), undefined);
});
