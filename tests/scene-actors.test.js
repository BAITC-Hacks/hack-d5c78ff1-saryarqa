import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTOR_CAPS, createActors } from '../scene/actors.js';
import { pointInRegion } from '../scene/camera.js';

const ring = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
const nura = { regionId: 'nura', polygons: [[ring(0, 0, 100, 100), ring(40, 40, 50, 60)]] };
const path = (id, kind, points) => ({ id, kind, points, illustrative: true, sourceIds: [] });
const geography = {
  schemaVersion: 1, status: 'unverified', viewBox: [0, 0, 100, 100],
  regions: [nura],
  paths: [
    path('walk', 'walking', [[5, 20], [95, 20]]),
    path('road', 'road', [[5, 30], [95, 30]]),
    path('bus', 'bus', [[5, 70], [95, 70]]),
    path('lrt', 'lrt-scenario', [[5, 80], [95, 80]]),
  ],
};
const walkable = {
  start: [10, 50], bounds: [0, 0, 100, 100],
  contains: (point) => pointInRegion(point, nura)
    && !(point[0] >= 20 && point[0] <= 30 && point[1] >= 45 && point[1] <= 55),
};
const maker = () => createActors({ geography, walkable });
const mayorPosition = (actors) => actors.getMayor().position;

test('large keyboard deltas stop at a building and never leave the walkable district', () => {
  const actors = maker();
  actors.update({ view: 'district', focusedRegion: 'nura' });
  for (let index = 0; index < 100; index += 1) actors.moveMayor(1, 0, 1000);
  const stopped = mayorPosition(actors);
  assert.ok(stopped[0] < 20 && stopped[0] > 19);
  assert.equal(stopped[1], 50);
  assert.equal(walkable.contains(stopped), true);
  for (let index = 0; index < 150; index += 1) actors.moveMayor(-1, 0, 1000);
  const edge = mayorPosition(actors);
  assert.ok(edge[0] >= 0 && edge[0] < 0.2);
  assert.equal(walkable.contains(edge), true);
  actors.destroy();
});

test('touch destination and reduced motion cannot jump across building or water hole', () => {
  const actors = maker();
  actors.update({ view: 'district', focusedRegion: 'nura', reducedMotion: true });
  assert.equal(actors.setDestination([90, 50]), true);
  assert.ok(mayorPosition(actors)[0] < 20);
  assert.equal(walkable.contains(mayorPosition(actors)), true);
  // Change to a water-only mask to exercise polygon-hole collision separately.
  actors.destroy();
  const waterWalkable = { start: [35, 50], bounds: [0, 0, 100, 100],
    contains: (point) => pointInRegion(point, nura) };
  const water = createActors({ geography, walkable: waterWalkable });
  water.update({ view: 'district', focusedRegion: 'nura', reducedMotion: true });
  assert.equal(water.setDestination([80, 50]), true);
  assert.ok(mayorPosition(water)[0] < 40);
  assert.equal(pointInRegion(mayorPosition(water), nura), true);
  water.destroy();
});

test('keyboard and touch reach the same unobstructed destination; hidden host does not advance', () => {
  const keyboard = maker();
  const touch = maker();
  keyboard.update({ view: 'district', focusedRegion: 'nura' });
  touch.update({ view: 'district', focusedRegion: 'nura', reducedMotion: true });
  assert.equal(touch.setDestination([15, 50]), true);
  for (let index = 0; index < 3; index += 1) keyboard.moveMayor(1, 0, 0.1);
  keyboard.moveMayor(1, 0, 0.0125);
  assert.ok(Math.abs(mayorPosition(keyboard)[0] - mayorPosition(touch)[0]) < 1e-8);
  const before = keyboard.getMayor();
  keyboard.setDestination([18, 50]);
  // The host pauses its animation clock while hidden, so it issues no step().
  keyboard.update({ view: 'district', focusedRegion: 'nura' });
  assert.deepEqual(keyboard.getMayor(), before);
  keyboard.step(0.1);
  assert.ok(mayorPosition(keyboard)[0] > before.position[0]);
  keyboard.destroy();
  touch.destroy();
});

test('verified counts are capped; unknown and stale data use labeled illustrative samples', () => {
  const sources = [{ id: 'bns', publisher: 'BNS', url: 'https://example.org/pop' }];
  const cityData = { sources, observations: [
    { id: 'population', metric: 'population', regionId: 'city', value: 1000000,
      status: 'verified', asOf: '2026-08-01', definition: 'City population', sourceId: 'bns' },
    { id: 'cars-old', metric: 'registered_cars', regionId: 'city', value: 100000,
      status: 'verified', asOf: '2025-01-01', definition: 'Registered cars', sourceId: 'bns' },
    { id: 'cars-new', metric: 'registered_cars', regionId: 'city', value: null,
      status: 'unavailable', asOf: '2026-01-01', definition: 'Unknown newer count', sourceId: 'bns' },
    { id: 'buses', metric: 'daily_active_buses', regionId: 'city', value: 1210,
      status: 'unverified', asOf: null, definition: 'Undated buses', sourceId: 'bns' },
  ] };
  const actors = maker();
  actors.update({ cityData });
  const metadata = actors.getMetadata();
  const mapping = Object.fromEntries(metadata.mappings.map((entry) => [entry.group, entry]));
  assert.equal(mapping.people.count, ACTOR_CAPS.people);
  assert.equal(mapping.people.mode, 'capped-source-sample');
  assert.equal(mapping.people.observedCount, 1000000);
  assert.equal(mapping.cars.count, 4);
  assert.equal(mapping.cars.observedCount, null);
  assert.equal(mapping.cars.observation.id, 'cars-new');
  assert.equal(mapping.buses.count, 2);
  assert.equal(mapping.buses.mode, 'illustrative-unknown-count');
  assert.equal(mapping.lrt.count, 1);
  assert.equal(actors.getActors().length, 24 + 4 + 2 + 1);
  actors.update({ cityData, view: 'district', focusedRegion: 'nura' });
  const detail = Object.fromEntries(actors.getMetadata().mappings.map((entry) => [entry.group, entry]));
  assert.equal(detail.people.observedCount, null);
  assert.equal(detail.people.count, 8);
  assert.equal(detail.people.cityObservation.value, 1000000);
  actors.destroy();
});

test('repeated updates and remounts keep stable counts; caller cannot mutate actor state', () => {
  const actors = maker();
  const count = actors.getActors().length;
  const first = actors.getActors()[0];
  first.position[0] = -999;
  first.heading = 999;
  assert.notEqual(actors.getActors()[0].position[0], -999);
  assert.notEqual(actors.getActors()[0].heading, 999);
  for (let index = 0; index < 20; index += 1) actors.update({ cityData: null, view: 'overview' });
  assert.equal(actors.getActors().length, count);
  const before = actors.getActors();
  actors.step(0);
  actors.step(NaN);
  assert.deepEqual(actors.getActors(), before);
  actors.destroy();
  assert.deepEqual(actors.getActors(), []);
  const remount = maker();
  assert.equal(remount.getActors().length, count);
  assert.deepEqual(remount.getActors().map((item) => item.id), before.map((item) => item.id));
  remount.destroy();
});
