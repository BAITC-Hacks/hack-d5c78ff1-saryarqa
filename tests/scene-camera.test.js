import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, pointInRegion, regionBounds, polygonsToPath } from '../scene/camera.js';

const square = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size],
  [x, y + size], [x, y]];
const multipart = { polygons: [[square(0, 0, 100), square(20, 20, 20)], [square(200, 0, 50)]] };
const close = (actual, expected, tolerance = 1e-8) => actual.forEach((value, index) => {
  assert.ok(Math.abs(value - expected[index]) < tolerance, `${actual} differs from ${expected}`);
});

test('region membership includes every part and excludes holes with either winding', () => {
  for (const region of [multipart, { polygons: multipart.polygons.map((polygon) =>
    polygon.map((ring) => [...ring].reverse())) }]) {
    assert.equal(pointInRegion([10, 10], region), true);
    assert.equal(pointInRegion([225, 25], region), true);
    assert.equal(pointInRegion([125, 25], region), false);
    assert.equal(pointInRegion([30, 30], region), false);
    assert.equal(pointInRegion([20, 30], region), false);
    assert.equal(pointInRegion([0, 50], region), true);
    assert.equal(pointInRegion([100, 100], region), true);
    assert.equal(pointInRegion([101, 100], region), false);
  }
  assert.equal(pointInRegion([0, 0], { polygons: [] }), false);
  assert.equal(pointInRegion([NaN, 0], multipart), false);
});

test('bounds and SVG paths preserve multipart geometry and holes without mutation', () => {
  const original = JSON.stringify(multipart);
  assert.deepEqual(regionBounds(multipart), {
    x: 0, y: 0, width: 250, height: 100, minX: 0, minY: 0, maxX: 250, maxY: 100,
  });
  const path = polygonsToPath(multipart);
  assert.equal((path.match(/M/g) ?? []).length, 3);
  assert.equal((path.match(/Z/g) ?? []).length, 3);
  assert.ok(path.includes('M20,20L40,20L40,40L20,40L20,20Z'));
  assert.equal(JSON.stringify(multipart), original);
  assert.equal(regionBounds({ polygons: [] }), null);
  assert.equal(polygonsToPath({ polygons: [] }), '');
});

for (const projection of ['top', 'tilted']) {
  test(`${projection}: world/screen round trips and SVG matrix agree after navigation`, () => {
    const camera = createCamera({ viewBox: [-300, 120, 1100, 800], width: 920, height: 610, projection });
    const points = [[-300, 120], [0, 0], [800, 920], [230.5, 642.1]];
    const check = () => points.forEach((point) => {
      const projected = camera.project(point);
      close(camera.unproject(projected), point);
      const [a, b, c, d, e, f] = camera.matrix();
      close(projected, [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f]);
    });
    check();
    camera.pan(123, -84).zoomAt(2.7, [180, 300]).setViewport(460, 820);
    check();
    camera.focus({ x: 100, y: 200, width: 150, height: 200 });
    check();
  });

  test(`${projection}: zoom preserves its world anchor, including clamped zoom`, () => {
    const camera = createCamera({ viewBox: [0, 0, 1000, 700], width: 840, height: 600, projection });
    camera.pan(50, 90);
    const anchor = [123, 427];
    const anchoredWorldPoint = camera.unproject(anchor);
    for (const factor of [2, 1e12, 0.01, 0.0001, 1.7]) {
      camera.zoomAt(factor, anchor);
      close(camera.project(anchoredWorldPoint), anchor);
      assert.ok(camera.getState().zoom >= 0.5 && camera.getState().zoom <= 8);
    }
  });

  test(`${projection}: pan uses pixels and resize preserves center and zoom`, () => {
    const camera = createCamera({ projection });
    const before = camera.project([200, 300]);
    camera.pan(75, -30);
    close(camera.project([200, 300]), [before[0] + 75, before[1] - 30]);
    camera.zoomAt(2);
    const state = camera.getState();
    camera.setViewport(375, 800);
    close(camera.project(state.center), [187.5, 400]);
    assert.equal(camera.getState().zoom, state.zoom);
  });

  test(`${projection}: reset fits world and focus fits all region parts`, () => {
    const camera = createCamera({ viewBox: [0, 0, 300, 200], width: 800, height: 600, projection });
    camera.focus(regionBounds(multipart));
    close(camera.project([125, 50]), [400, 300]);
    for (const point of [[0, 0], [250, 0], [250, 100], [0, 100]]) {
      const [x, y] = camera.project(point);
      assert.ok(x >= 0 && x <= 800 && y >= 0 && y <= 600);
    }
    camera.pan(500, -200).zoomAt(6).reset();
    close(camera.project([150, 100]), [400, 300]);
    assert.equal(camera.getState().zoom, 1);
    assert.equal(camera.getState().projection, projection);
  });
}

test('projection toggle preserves world center, picking and independent state snapshots', () => {
  const viewBox = [0, 0, 300, 200];
  const camera = createCamera({ viewBox, width: 800, height: 600 });
  viewBox[2] = 1;
  camera.pan(15, 25).zoomAt(2);
  const state = camera.getState();
  camera.setProjection('tilted');
  close(camera.project(state.center), [400, 300]);
  assert.equal(pointInRegion(camera.unproject(camera.project([225, 25])), multipart), true);
  assert.equal(pointInRegion(camera.unproject(camera.project([30, 30])), multipart), false);
  state.center[0] = -999;
  state.viewBox[2] = -999;
  assert.notEqual(camera.getState().center[0], -999);
  assert.equal(camera.getState().viewBox[2], 300);
  camera.setProjection('top');
  close(camera.unproject(camera.project([225, 25])), [225, 25]);
});

test('invalid navigation leaves a valid camera and collapsed viewport is invertible', () => {
  const camera = createCamera();
  const matrix = camera.matrix();
  camera.zoomAt(0).zoomAt(Infinity).zoomAt(-1).pan(NaN, 10).focus(null);
  assert.deepEqual(camera.matrix(), matrix);
  camera.setViewport(0, 0);
  close(camera.unproject(camera.project([230, 450])), [230, 450]);
  assert.throws(() => camera.setProjection('unknown'), RangeError);
  assert.throws(() => createCamera({ viewBox: [0, 0, 0, 10] }), TypeError);
  assert.throws(() => camera.setViewport(NaN, 100), TypeError);
});
import { createWorld, REGION_IDS } from '../scene/world.js';
import { createActors, ACTOR_CAPS } from '../scene/actors.js';

const activityFixture = () => ({
  schemaVersion: 1, status: 'fixture', viewBox: [0, 0, 600, 400],
  regions: REGION_IDS.map((regionId, index) => ({
    regionId, label: regionId,
    labelAnchor: [(index % 3) * 200 + 100, Math.floor(index / 3) * 200 + 100],
    polygons: [[square((index % 3) * 200, Math.floor(index / 3) * 200, 200)]],
  })),
  paths: ['walking', 'road', 'bus', 'lrt-scenario'].map((kind, index) => ({
    id: kind, kind, points: [[220, 300 - index * 10], [380, 300 - index * 10]],
    illustrative: true, sourceIds: [],
  })),
});

test('activity caps preserve unknown district counts and reject unapproved routes', () => {
  const geography = activityFixture();
  geography.paths.push({ id: 'unapproved', kind: 'road', points: [[220, 250], [380, 250]] });
  const world = createWorld(geography);
  const actors = createActors({ geography, walkable: world.walkable });
  const observations = ['population', 'registered_cars', 'daily_active_buses'].map(metric => ({
    id: metric, metric, regionId: 'city', value: 10000000, unit: 'count',
    asOf: '2026', sourceId: 'fixture', definition: 'Test count', status: 'verified',
  }));
  const cityData = { sources: [{ id: 'fixture', url: 'https://example.org/statistics' }], observations };
  actors.update({ cityData });
  assert.equal(actors.getActors().length, Object.values(ACTOR_CAPS).reduce((sum, cap) => sum + cap, 0));
  assert.equal(actors.getMetadata().mappings.find(m => m.kind === 'person').observedCount, 10000000);
  actors.update({ view: 'district', focusedRegion: 'nura' });
  const population = actors.getMetadata().mappings.find(m => m.kind === 'person');
  assert.equal(population.observedCount, null);
  assert.equal(population.cityObservation.value, 10000000);
  assert.equal(population.count, population.fallbackCount);
  assert(actors.getMetadata().mappings.every(mapping => mapping.paths.every(path => path.id !== 'unapproved')));
  assert.equal(actors.getMetadata().liveTraffic, false);
  assert(actors.getMetadata().mappings.find(m => m.kind === 'lrt').paths.every(path => path.illustrative));
  actors.destroy();
});

test('world mask and mayor traversal exclude building footprints, including reduced motion', () => {
  const geography = activityFixture();
  const original = JSON.stringify(geography);
  const world = createWorld(geography);
  const actors = createActors({ geography, walkable: world.walkable });
  actors.update({ view: 'district', focusedRegion: 'nura' });
  const start = actors.getMayor().position;
  const building = world.pieces.find(piece => piece.detail);
  const destination = building.position.map((value, index) => start[index] + (value - start[index]) * 1.45);
  assert.equal(world.walkable.contains(building.position), false);
  assert.equal(world.walkable.contains(destination), true);
  assert.equal(actors.setDestination(destination), true);
  for (let index = 0; index < 200; index += 1) actors.step(.1);
  assert(world.walkable.contains(actors.getMayor().position));
  assert.notDeepEqual(actors.getMayor().position, destination);
  const stopped = actors.getMayor().position;
  actors.update({ reducedMotion: true });
  const stationary = actors.getActors();
  actors.step(10000);
  assert.deepEqual(actors.getActors(), stationary);
  actors.setDestination(destination);
  assert.deepEqual(actors.getMayor().position, stopped);
  assert.equal(actors.setDestination(building.position), false);
  assert.equal(JSON.stringify(geography), original);
  actors.destroy();
});

test('actor remount resets deterministic activity and old instances remain inert', () => {
  const geography = activityFixture();
  const world = createWorld(geography);
  const first = createActors({ geography, walkable: world.walkable });
  const initial = first.getActors();
  first.step(.1);
  assert.notDeepEqual(first.getActors(), initial);
  const moved = first.getActors();
  first.update({ view: 'overview' });
  first.update({ view: 'overview' });
  assert.deepEqual(first.getActors(), moved);
  const exposed = first.getActors();
  exposed[0].position[0] = -999;
  assert.notEqual(first.getActors()[0].position[0], -999);
  first.destroy();
  first.destroy();
  first.update({ view: 'district', focusedRegion: 'nura' });
  first.step(.1);
  assert.deepEqual(first.getActors(), []);
  assert.equal(first.getMayor(), null);
  assert.equal(first.setDestination(world.walkable.start), false);
  const second = createActors({ geography, walkable: world.walkable });
  assert.deepEqual(second.getActors(), initial);
  assert.equal(second.getMetadata().destroyed, false);
  second.destroy();
});

test('exact world segment guard blocks holes narrower than a movement sample', () => {
  const geography = activityFixture();
  const nura = geography.regions.find(region => region.regionId === 'nura');
  nura.polygons[0].push([[300.03, 299], [300.031, 299], [300.031, 301], [300.03, 301], [300.03, 299]]);
  const world = createWorld(geography);
  assert(world.walkable.contains([301, 300]));
  assert.equal(world.walkable.canTraverse([300, 300], [301, 300]), false);
  const actors = createActors({ geography, walkable: world.walkable });
  actors.update({ view: 'district', focusedRegion: 'nura', reducedMotion: true });
  actors.setDestination([301, 300]);
  assert(actors.getMayor().position[0] < 300.03);
  actors.update({ reducedMotion: false });
  actors.moveMayor(1, 0, .1);
  assert(actors.getMayor().position[0] < 300.03);
  actors.destroy();
});
