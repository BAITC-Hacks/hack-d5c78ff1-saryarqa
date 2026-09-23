import test from 'node:test';
import { buildingManifest } from './fixtures/building-tiles.js';
import assert from 'node:assert/strict';
import { loadScenePackage, createSceneAdapter } from '../game/scene-adapter.js';
import { REGIONS } from '../game/contracts.js';
import { ASTANA_MAP_FILES } from '../scene/load-map.js';

const fixture = () => ({
  '/api/capabilities': { scene: true, assets: true, geography: true, cityData: true },
  '/assets/game/manifest.json': { schemaVersion: 1, assets: [] },
  '/scene/styles.css': '',
  '/data/geography/astana.json': { schemaVersion: 1, status: 'verified', regions: REGIONS.map((item) => ({ ...item })) },
  '/data/city/context.json': { schemaVersion: 1, sources: [], observations: [] },
});
const fetcher = (data) => async (url) => ({ ok: url in data, json: async () => data[url] });

function adapterHarness(createScene, resources = fixture()) {
  let listener;
  const dispatched = [];
  const statuses = [];
  const root = { clears: 0, replaceChildren() { this.clears += 1; } };
  const session = {
    getSnapshot: () => ({ mode: 'game' }),
    subscribe(fn) { listener = fn; fn(this.getSnapshot()); return () => { listener = null; }; },
    dispatch(action) { dispatched.push(action); },
  };
  const documentRef = { hidden: false, addEventListener() {}, removeEventListener() {}, head: { append() {} }, createElement: () => ({ remove() {} }) };
  const motion = { matches: false, addEventListener() {}, removeEventListener() {} };
  const adapter = createSceneAdapter({ root, session, documentRef, motion, fetchImpl: fetcher(resources), loadModule: async () => ({ createScene }), onStatus: (value) => statuses.push(value) });
  return { adapter, root, dispatched, statuses, update: () => listener?.(session.getSnapshot()) };
}

test('retry destroys the old scene and ignores its late intents; dispose is idempotent', async () => {
  const intents = [];
  let destroyed = 0;
  const h = adapterHarness(({ onIntent }) => {
    intents.push(onIntent);
    return { update() {}, destroy() { destroyed += 1; } };
  });
  await h.adapter.connect();
  await h.adapter.connect();
  assert.equal(destroyed, 1);
  intents[0]({ type: 'FOCUS_REGION', regionId: 'esil' });
  assert.equal(h.dispatched.length, 0);
  intents[1]({ type: 'ADD_MEASURE', id: 'M7', district: 'Нура' });
  assert.equal(h.dispatched.length, 0);
  intents[1]({ type: 'FOCUS_REGION', regionId: 'nura' });
  assert.equal(h.dispatched.length, 1);
  h.adapter.destroy(); h.adapter.destroy();
  intents[1]({ type: 'FOCUS_REGION', regionId: 'esil' });
  assert.equal(h.dispatched.length, 1);
  assert.equal(destroyed, 2);
});

const atlasFixture = () => {
  const data = {
    '/api/capabilities': { scene: true, atlas: true, assets: false, geography: false, cityData: false },
    '/scene/styles.css': '',
  };
  for (const path of Object.values(ASTANA_MAP_FILES)) data[path] = { type: 'FeatureCollection', features: [] };
  data[ASTANA_MAP_FILES.seed] = { working_bbox: { value: [71.2, 51, 71.8, 51.4] } };
  data[ASTANA_MAP_FILES.buildingManifest] = buildingManifest({ populated: 1 });
  data[ASTANA_MAP_FILES.majorRoads] = [];
  data[ASTANA_MAP_FILES.landmarkPositions] = {schemaVersion:1,positions:[]};
  data[ASTANA_MAP_FILES.trafficCorridors] = [];
  data[ASTANA_MAP_FILES.roads].features = [{ type: 'Feature', id: 'road-1', properties: { highway: 'primary' },
    geometry: { type: 'LineString', coordinates: [[71.4, 51.1], [71.5, 51.2]] } }];
  return data;
};

test('adapter mounts the real atlas without legacy resources and forwards playback identity', async () => {
  let options;
  let updateContext;
  const h = adapterHarness(input => {
    options = input;
    return { update({ context }) { updateContext = context; }, destroy() {} };
  }, atlasFixture());
  await h.adapter.connect();
  assert.equal(h.statuses.at(-1).phase, 'ready');
  assert.equal(options.mapData.geographic, true);
  assert.equal(options.mapData.roads.length, 1);
  assert.equal(options.geography, undefined);
  assert.equal(options.assets, undefined);
  assert.deepEqual(updateContext.cityData.observations, []);
  const complete = { type: 'PLAYBACK_COMPLETE', planRevision: 3, runId: 8 };
  options.onIntent(complete);
  assert.deepEqual(h.dispatched, [complete]);
  h.adapter.destroy();
});

test('a broken atlas is reported explicitly without switching to legacy geometry', async () => {
  const data = { ...fixture(), ...atlasFixture() };
  delete data[ASTANA_MAP_FILES.roads];
  await assert.rejects(loadScenePackage({ fetchImpl: fetcher(data), loadModule: () => { throw new Error('Must not import'); } }), /MAP_RESOURCE_UNAVAILABLE:.*roads/);
});

test('renderer update failure clears partial DOM even if destroy throws', async () => {
  let intent;
  const h = adapterHarness(({ onIntent }) => {
    intent = onIntent;
    return { update() { throw new Error('GPU failed'); }, destroy() { throw new Error('Cleanup failed'); } };
  });
  await h.adapter.connect();
  assert.equal(h.statuses.at(-1).reason, 'scene-update-failed');
  assert.ok(h.root.clears >= 2);
  intent({ type: 'FOCUS_REGION', regionId: 'nura' });
  assert.equal(h.dispatched.length, 0);
  h.update();
  assert.doesNotThrow(() => h.adapter.destroy());
});

test('missing teammate resources leave calculator available without importing scene', async () => {
  const data = { '/api/capabilities': { scene: false } };
  const result = await loadScenePackage({ fetchImpl: fetcher(data), loadModule: () => { throw new Error('Must not import'); } });
  assert.equal(result.ready, false);
});

test('only verified six-region geometry can mount, with Saraishyk unscored', async () => {
  const data = fixture();
  const createScene = () => {};
  const result = await loadScenePackage({ fetchImpl: fetcher(data), loadModule: async () => ({ createScene }) });
  assert.equal(result.createScene, createScene);
  data['/data/geography/astana.json'].regions[5].simulationDistrict = 'Нура';
  await assert.rejects(loadScenePackage({ fetchImpl: fetcher(data), loadModule: async () => ({ createScene }) }), /INVALID_REGIONS/);
});

test('fixture geography cannot be silently labeled a real city map', async () => {
  const data = fixture();
  data['/data/geography/astana.json'].status = 'fixture';
  const result = await loadScenePackage({ fetchImpl: fetcher(data), loadModule: () => { throw new Error('Must not import'); } });
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'awaiting-verified-geography');
});

test('missing context uses an empty dataset, malformed context or renderer fails explicitly', async () => {
  const data = fixture();
  data['/api/capabilities'].cityData = false;
  const result = await loadScenePackage({ fetchImpl: fetcher(data), loadModule: async () => ({ createScene() {} }) });
  assert.deepEqual(result.cityData.observations, []);
  await assert.rejects(loadScenePackage({ fetchImpl: fetcher(data), loadModule: async () => ({}) }), /INVALID_SCENE_INTERFACE/);
  data['/api/capabilities'].cityData = true;
  data['/data/city/context.json'].observations = null;
  await assert.rejects(loadScenePackage({ fetchImpl: fetcher(data), loadModule: async () => ({ createScene() {} }) }), /INVALID_CONTEXT/);
});
