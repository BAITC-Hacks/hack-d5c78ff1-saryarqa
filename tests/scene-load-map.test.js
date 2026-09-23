import test from 'node:test';
import { buildingManifest } from './fixtures/building-tiles.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASTANA_MAP_FILES, loadAstanaMap } from '../scene/load-map.js';
import { createAppServer } from '../server.js';
import { loadScenePackage } from '../game/scene-adapter.js';

const fixture = () => {
  const files = Object.fromEntries(Object.values(ASTANA_MAP_FILES).map(path => [path, { type: 'FeatureCollection', features: [] }]));
  files[ASTANA_MAP_FILES.seed] = { working_bbox: { value: [71.2, 51, 71.8, 51.4] }, center: { lon: 71.45, lat: 51.15 } };
  files[ASTANA_MAP_FILES.buildingManifest] = buildingManifest({ populated: 1 });
  files[ASTANA_MAP_FILES.trafficCorridors] = [];
  files[ASTANA_MAP_FILES.majorRoads] = [];
  files[ASTANA_MAP_FILES.landmarkPositions] = { schemaVersion:1, positions:[] };
  files[ASTANA_MAP_FILES.roads].features.push({ type: 'Feature', id: 'road-1',
    properties: { name: 'Тестовая улица', highway: 'primary' },
    geometry: { type: 'LineString', coordinates: [[71.4, 51.1], [71.5, 51.2]] } });
  return files;
};

test('map loader fetches every manifest layer in parallel with the supplied cancellation signal', async () => {
  const files = fixture();
  const controller = new AbortController();
  const requested = [];
  const pending = [];
  const promise = loadAstanaMap({ signal: controller.signal, fetchImpl: (path, options) => {
    requested.push(path);
    assert.equal(options.signal, controller.signal);
    return new Promise(resolve => pending.push(() => resolve({ ok: true, json: async () => files[path] })));
  } });
  assert.equal(requested.length, 12);
  assert.equal(new Set(requested).size, 12);
  pending.forEach(resolve => resolve());
  const map = await promise;
  assert.equal(map.geographic, true);
  assert.equal(map.roads.length, 1);
  assert.deepEqual(map.roads[0].points[0], map.projectLonLat([71.4, 51.1]));
  assert.equal(map.sourceStatus.districts, 'empty');
  assert.equal(map.buildingCount, 1);
  assert.equal(typeof map.createBuildingSource, 'function');
  const source = map.createBuildingSource();
  assert.equal(requested.length, 12, 'constructing the tile source must not fetch all tiles');
  source.destroy();
});

test('map loader rejects unavailable or invalid real layers instead of inventing geometry', async () => {
  const files = fixture();
  const fetchImpl = async path => ({ ok: path in files, json: async () => files[path] });
  const districts = files[ASTANA_MAP_FILES.districts];
  delete files[ASTANA_MAP_FILES.districts];
  await assert.rejects(loadAstanaMap({ fetchImpl }), /MAP_RESOURCE_UNAVAILABLE:.*districts-current/);
  files[ASTANA_MAP_FILES.districts] = districts;
  files[ASTANA_MAP_FILES.landscape] = { features: [] };
  await assert.rejects(loadAstanaMap({ fetchImpl }), /INVALID_MAP_DATA:landscape/);
  files[ASTANA_MAP_FILES.landscape] = { type: 'FeatureCollection', features: [] };
  files[ASTANA_MAP_FILES.roads].features = [];
  await assert.rejects(loadAstanaMap({ fetchImpl }), /INVALID_MAP_DATA:roads/);
});

test('main app loads the actual sourced atlas through public server routes', { timeout: 15000 }, async t => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const requested = [];
  const createScene = () => {};
  const result = await loadScenePackage({
    fetchImpl: (path, options) => { requested.push(path); return fetch(`${base}${path}`, options); },
    loadModule: async () => ({ createScene }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.createScene, createScene);
  assert.ok(result.mapData.roads.length > 100);
  assert.ok(result.mapData.buildings.length > 100);
  assert.ok(result.mapData.landscape.length > 0);
  assert.equal(result.mapData.landmarks.length, 17);
  const tower = result.mapData.landmarks.find(item => item.id === 'baiterek');
  assert.deepEqual(tower.originalCoordinates, [71.4256, 51.1283]);
  assert.ok(tower.coordinates[0] > 71.4304 && tower.coordinates[0] < 71.4305);
  assert.equal(tower.sourceUrl, 'https://www.openstreetmap.org/way/230401645');
  assert.equal(result.mapData.parkAnchors.length, 5);
  assert.equal(result.mapData.corridors.length, 16);
  assert.deepEqual(result.mapData.regions.map(region => region.regionId).sort(), ['almaty', 'baikonur', 'esil', 'nura', 'saraishyk', 'saryarka']);
  assert.equal(result.mapData.regions.find(region => region.regionId === 'saraishyk').simulationDistrict, null);
  assert.ok(Object.values(ASTANA_MAP_FILES).every(path => requested.includes(path)));
  assert.ok(!requested.includes('/assets/game/manifest.json'));
  assert.ok(!requested.includes('/data/geography/astana.json'));
  assert.ok(result.mapData.buildingCount > result.mapData.buildings.length);
  const tileRequests = () => requested.filter(path => path.includes('/buildings-tiles/'));
  assert.deepEqual(tileRequests(), [], 'initial atlas loading must not fetch the full building collection');
  let completed;
  const loaded = new Promise((resolve, reject) => { completed = { resolve, reject }; });
  const buildings = result.mapData.createBuildingSource({ onChange: () => {
    const state = buildings.getState();
    if (state.failed) completed.reject(new Error('A visible building tile failed to load'));
    else if (!state.pending) completed.resolve();
  } });
  t.after(() => buildings.destroy());
  const [lon, lat] = tower.coordinates;
  buildings.request([lon - .0001, lat - .0001, lon + .0001, lat + .0001]);
  await loaded;
  assert.ok(tileRequests().length > 0 && tileRequests().length < 16);
  assert.equal(buildings.getState().loadedTiles, tileRequests().length);
  assert.equal(buildings.getState().failed, 0);
  assert.ok(buildings.getBuildings().length >= result.mapData.buildings.length);
  assert.equal(new Set(buildings.getBuildings().map(feature => feature.id)).size, buildings.getBuildings().length);
  const css = await readFile(new URL('../scene/styles.css', import.meta.url), 'utf8');
  assert.match(css, /^@import url\(['"]\.\/atlas\.css['"]\);/);
});
