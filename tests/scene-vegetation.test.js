import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVegetation, createVegetation } from '../scene/vegetation.js';
import { pointInRegion } from '../scene/camera.js';

const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const shape = (id, kind, ...rings) => ({ id, kind, polygons: [rings] });
const park = shape('municipal-green-1', 'park', ring(0, 0, 30, 30));
const options = { landscape: [park], buildings: [], viewBounds: [0, 0, 20, 20], pixelsPerWorldUnit: 20 };
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('samples use source polygons only, never park anchors or other unlabeled land', () => {
  assert.deepEqual(selectVegetation({ ...options, landscape: [{ id: 'garden-anchor', kind: 'park', position: [5, 5] }] }), []);
  assert.deepEqual(selectVegetation({ ...options, landscape: [shape('land', 'landscape', ring(0, 0, 20, 20))] }), []);
  assert.deepEqual(selectVegetation({ ...options, landscape: [shape('water', 'water', ring(0, 0, 20, 20))] }), []);
  const trees = selectVegetation(options);
  assert.ok(trees.length > 0);
  assert.ok(trees.every(tree => tree.sourceId === park.id && pointInRegion(tree.position, park)));
  assert.ok(trees.some(tree => tree.kind === 'pine'));
  assert.ok(trees.some(tree => tree.kind === 'deciduous'));
});

test('complete crown and shadow footprint remains inside green polygons and outside holes, water and buildings', () => {
  const withHole = shape('green-with-hole', 'park', ring(0, 0, 20, 20), ring(4, 4, 8, 8));
  const water = shape('river', 'water', ring(10, 0, 13, 20));
  const building = shape('building', 'building', ring(14, 3, 19, 8));
  for (const scale of [4, 20]) {
    const trees = selectVegetation({ ...options, landscape: [withHole, water], buildings: [building], pixelsPerWorldUnit: scale });
    assert.ok(trees.length > 10);
    for (const tree of trees) for (let index = 0; index < 24; index++) {
      const angle = index / 24 * Math.PI * 2;
      const sample = [tree.position[0] + Math.cos(angle) * tree.radius * 1.89,
        tree.position[1] + Math.sin(angle) * tree.radius * 1.89];
      assert.ok(pointInRegion(sample, withHole), `${tree.id} spills outside its source polygon`);
      assert.equal(pointInRegion(sample, water), false);
      assert.equal(pointInRegion(sample, building), false);
    }
  }
});

test('road segments block trees by actual distance, including both sides of spatial-index cell edges', () => {
  const road = { id: 'road', points: [[0, 4], [20, 4]], kind: 'primary' };
  const trees = selectVegetation({ ...options, roads: [road], pixelsPerWorldUnit: 4 });
  assert.ok(trees.length > 0);
  for (const tree of trees) assert.ok(Math.abs(tree.position[1] - 4) > 0.26 + tree.radius * 1.9);
});

test('indexed complex source rings preserve the same containment and boundary clearance as simple outlines', () => {
  const densify = outline => outline.slice(0, -1).flatMap((a, index) => {
    const b = outline[index + 1];
    return Array.from({ length: 32 }, (_, step) => [a[0] + (b[0] - a[0]) * step / 32, a[1] + (b[1] - a[1]) * step / 32]);
  }).concat([outline[0]]);
  const source = [shape('park-complex', 'park', ring(0, 0, 20, 20), ring(4, 4, 8, 8)),
    shape('water-complex', 'water', ring(10, 0, 12, 20))];
  const dense = source.map(feature => ({ ...feature, polygons: feature.polygons.map(polygon => polygon.map(densify)) }));
  for (const pixelsPerWorldUnit of [4, 20]) {
    assert.deepEqual(selectVegetation({ ...options, landscape: source, pixelsPerWorldUnit }),
      selectVegetation({ ...options, landscape: dense, pixelsPerWorldUnit }));
  }
});

test('pan and projection preserve each source tree position; higher LOD never moves matching trees', () => {
  const baseline = selectVegetation({ ...options, pixelsPerWorldUnit: 6, projection: 'top', maxCount: 450 });
  const panned = selectVegetation({ ...options, viewBounds: [2, 2, 22, 22], pixelsPerWorldUnit: 6, projection: 'tilted' });
  const zoomed = selectVegetation({ ...options, pixelsPerWorldUnit: 20, projection: 'tilted' });
  const byId = new Map(baseline.map(tree => [tree.id, tree]));
  let matches = 0;
  for (const tree of [...panned, ...zoomed]) {
    const original = byId.get(tree.id); if (!original) continue;
    matches++;
    assert.deepEqual(tree.position, original.position);
    assert.equal(tree.kind, original.kind);
    assert.equal(tree.variant, original.variant);
    assert.equal(tree.physicalRadius, original.physicalRadius);
  }
  assert.ok(matches > 10);
  assert.deepEqual(selectVegetation({ ...options, projection: 'top' }), selectVegetation({ ...options, projection: 'tilted' }));
});

test('world grid and cap are deterministic across source ordering, repeated calls and viewport changes', () => {
  const other = shape('municipal-green-2', 'park', ring(10, 0, 30, 20));
  const ordered = { ...options, landscape: [park, other] };
  assert.deepEqual(selectVegetation(ordered), selectVegetation({ ...ordered, landscape: [other, park] }));
  assert.deepEqual(selectVegetation(ordered), selectVegetation(ordered));
  assert.equal(selectVegetation(options).length, 450);
  assert.equal(selectVegetation({ ...options, maxCount: 200 }).length, 200);
  assert.equal(selectVegetation({ ...options, maxCount: 10000 }).length, 450);
  assert.equal(selectVegetation({ ...options, maxCount: 0 }).length, 0);
  assert.deepEqual(selectVegetation({ ...options, viewBounds: [1000, 1000, 1100, 1100] }), []);
});

test('street-scale crowns are legible, overview is cheap and narrow strips cannot receive oversized trees', () => {
  const trees = selectVegetation({ ...options, pixelsPerWorldUnit: 4 });
  assert.ok(trees.length > 0);
  assert.ok(trees.every(tree => tree.radius * 4 >= 1.55));
  assert.deepEqual(selectVegetation({ ...options, pixelsPerWorldUnit: 1 }), []);
  const strip = shape('narrow-source-green', 'park', ring(0, 0, 20, .5));
  assert.deepEqual(selectVegetation({ ...options, landscape: [strip], pixelsPerWorldUnit: 4 }), []);
  assert.deepEqual(selectVegetation({ ...options, viewBounds: [0, 0, NaN, 20] }), []);
});

test('new building data removes blocked samples and frozen source geometry is never mutated', () => {
  const input = freeze({ ...options, landscape: [structuredClone(park)], buildings: [] });
  const before = JSON.stringify(input), trees = selectVegetation(input);
  const chosen = trees[0];
  const [x, y] = chosen.position;
  const blocked = selectVegetation({ ...input, buildings: [shape('new-building', 'building', ring(x - 1, y - 1, x + 1, y + 1))] });
  assert.equal(blocked.some(tree => tree.id === chosen.id), false);
  trees[0].position[0] = -200;
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(selectVegetation(input)[0].position[0], -200);
});

test('SVG uses a small number of merged material paths, no IDs, and explicit illustrative metadata', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const element = tag => ({ tag, attributes: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = String(value); }, appendChild(child) { this.children.push(child); return child; } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElementNS: (_ns, tag) => element(tag) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  const top = createVegetation({ ...options, projection: 'top' });
  const tilted = createVegetation({ ...options, projection: 'tilted' });
  assert.equal(top.tag, 'g');
  assert.equal(top.attributes['data-count'], '450');
  assert.equal(top.attributes['data-illustrative'], 'true');
  assert.match(top.attributes['data-canopy-scale'], /not-inventory/);
  assert.equal(tilted.attributes['data-count'], '450');
  assert.ok(top.children.length <= 15 && tilted.children.length <= 15);
  assert.equal(top.children.some(child => child.attributes['data-material'] === 'trunk'), false);
  assert.equal(tilted.children.some(child => child.attributes['data-material'] === 'trunk'), true);
  for (const node of [top, tilted, ...top.children, ...tilted.children]) {
    assert.equal('id' in node.attributes, false);
    if (node.tag === 'path') assert.doesNotMatch(node.attributes.d, /NaN|Infinity|undefined/);
  }
});
