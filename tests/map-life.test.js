import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWalkingPaths, createMapLife, getCitizenReaction } from '../scene/map-life.js';
import { createCamera, pointInRegion, segmentsCross } from '../scene/camera.js';
import { readFileSync } from 'node:fs';
import { ASTANA_MAP_FILES } from '../scene/load-map.js';
import { createGeoData } from '../scene/geodata.js';

const square = (x, y, size) => ({ polygons: [[[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]]] });
const regions = [{ ...square(0, 0, 100), regionId: 'nura' }];
const map = { center: [50, 50], regions, roads: Array.from({ length: 12 }, (_, i) => ({ kind: 'residential', points: [[5, 5 + i * 8], [95, 5 + i * 8]] })),
  buildings: [square(47, 20, 6)], landscape: [{ ...square(47, 47, 6), kind: 'water' }], parkAnchors: [] };

test('representative routes are deterministic, bounded and avoid building/water crossings', () => {
  const paths = buildWalkingPaths(map, regions);
  assert.ok(paths.length > 5 && paths.length <= 32);
  assert.deepEqual(paths, buildWalkingPaths(map, regions));
  for (const path of paths) {
    assert.equal(path.regionId, 'nura');
    for (const exclusion of [...map.buildings, ...map.landscape]) {
      assert.equal(pointInRegion(path.a, exclusion), false);
      assert.equal(pointInRegion(path.b, exclusion), false);
      for (const polygon of exclusion.polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
        assert.equal(segmentsCross(path.a, path.b, ring[i - 1], ring[i]), false);
      }
    }
  }
});

test('reaction preserves negative tradeoffs instead of presenting every plan as positive', () => {
  assert.equal(getCitizenReaction({}), 'neutral');
  assert.equal(getCitizenReaction({ E1: 2, E2: 0 }), 'positive');
  assert.equal(getCitizenReaction({ T1: -2 }), 'negative');
  assert.equal(getCitizenReaction({ T1: -2, B2: 12 }), 'mixed');
  assert.equal(getCitizenReaction({ T1: NaN, B2: '12' }), 'neutral');
});

test('render reuses nodes, respects reduced motion, updates reactions and destroys its own subtree', () => {
  let created = 0;
  const doc = { createElementNS: (_, tag) => {
    created++;
    return { tag, attributes: {}, children: [], ownerDocument: doc,
      setAttribute(key, value) { this.attributes[key] = value; },
      appendChild(node) { node.parent = this; this.children.push(node); },
      remove() { this.parent.children = this.parent.children.filter(node => node !== this); } };
  } };
  const layer = doc.createElementNS('', 'g');
  const life = createMapLife({ layer, map, regions });
  const camera = createCamera({ viewBox: [0, 0, 100, 100], width: 500, height: 500 });
  const args = { camera, width: 500, height: 500, seconds: 0, reducedMotion: true,
    visualState: { regions: [{ regionId: 'nura', effects: { T1: -2, B2: 12 } }] } };
  life.render(args);
  const before = JSON.stringify(layer.children, (key, value) => key === 'parent' || key === 'ownerDocument' ? undefined : value);
  const nodeCount = created;
  life.render({ ...args, seconds: 100 });
  assert.equal(created, nodeCount);
  assert.equal(JSON.stringify(layer.children, (key, value) => key === 'parent' || key === 'ownerDocument' ? undefined : value), before);
  assert.ok(life.getDiagnostics().visibleCount > 0);
  assert.equal(life.getDiagnostics().movingCount, 0);
  assert.equal(life.getDiagnostics().reactions.mixed, life.getDiagnostics().count);
  life.render({ ...args, reducedMotion: false, seconds: 4, visualState: { regions: [] } });
  assert.equal(created, nodeCount);
  assert.equal(life.getDiagnostics().reactions.neutral, life.getDiagnostics().count);
  assert.ok(life.getDiagnostics().movingCount > 0);
  camera.zoomAt(6);
  life.render({ ...args, reducedMotion: true });
  const visiblePerson = layer.children[0].children.find(node => node.attributes.display === '');
  const art = visiblePerson.children.find(node => node.tag === 'image');
  assert.equal(art.attributes.display, '');
  assert.match(art.attributes.href, /citizen-0[123]-still\.png$/);
  life.destroy(); life.destroy();
  assert.equal(layer.children.length, 0);
  assert.equal(life.getDiagnostics().destroyed, true);
});

test('real map has a bounded representative group across sourced districts in the initial viewport', () => {
  const data = createGeoData(Object.fromEntries(Object.entries(ASTANA_MAP_FILES).map(([key, path]) =>
    [key, JSON.parse(readFileSync(new URL(`..${path}`, import.meta.url), 'utf8'))])));
  const paths = buildWalkingPaths(data);
  assert.equal(paths.length, 32);
  assert.equal(new Set(paths.map(path => path.regionId)).size, 6);
  const camera = createCamera({ viewBox: data.viewBox, width: 1000, height: 700, projection: 'tilted', maxZoom: 40 });
  camera.focus([data.center[0] - 150, data.center[1] - 110, 300, 220]);
  const visible = paths.filter(path => { const [x, y] = camera.project(path.midpoint); return x > 0 && x < 1000 && y > 0 && y < 700; });
  assert.ok(visible.length >= 24, `Expected visible representative crowd, got ${visible.length}`);
});
