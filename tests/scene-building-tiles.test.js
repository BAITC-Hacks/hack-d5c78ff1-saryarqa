import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildingTileSource, validateBuildingManifest } from '../scene/building-tiles.js';
import { buildingManifest, buildingSeed, tileCollection } from './fixtures/building-tiles.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const inside = tile => {
  const [west, south, east, north] = tile.bbox;
  return [west + (east - west) * .25, south + (north - south) * .25,
    west + (east - west) * .75, south + (north - south) * .75];
};

function harness(t, { manifest = buildingManifest(), fallback = [] } = {}) {
  const requests = [];
  let inFlight = 0, maximum = 0, changes = 0;
  const source = createBuildingTileSource({ manifest, seed: buildingSeed, fallback,
    onChange: () => { changes++; },
    fetchImpl: (path, options) => new Promise((resolve, reject) => {
      inFlight++; maximum = Math.max(maximum, inFlight);
      requests.push({ path, signal: options.signal, settled: false,
        resolve(value) { assert.equal(this.settled, false); this.settled = true; inFlight--; resolve(value); },
        reject(error) { assert.equal(this.settled, false); this.settled = true; inFlight--; reject(error); },
      });
    }),
  });
  t.after(() => source.destroy());
  const succeed = async (index, collection) => {
    const request = requests[index];
    const tile = manifest.tiles.find(tile => request.path.endsWith(tile.path));
    request.resolve({ ok: true, json: async () => collection ?? tileCollection(tile) });
    await flush();
  };
  return { source, requests, manifest, succeed, maximum: () => maximum, changes: () => changes };
}

test('building tiles request only visible populated bounds and reuse cached tiles', async t => {
  const h = harness(t, { manifest: buildingManifest({ populated: 2 }) });
  assert.equal(h.requests.length, 0);
  h.source.request(inside(h.manifest.tiles[0]));
  assert.deepEqual(h.requests.map(r => r.path), ['/scene/data/astana/buildings-tiles/r0-c0.geojson']);
  h.source.request(inside(h.manifest.tiles[0]));
  assert.equal(h.requests.length, 1);
  await h.succeed(0);
  assert.deepEqual(h.source.getBuildings().map(b => b.id), ['building-r0-c0']);
  h.source.request(inside(h.manifest.tiles[1]));
  assert.equal(h.source.getBuildings().length, 0, 'off-screen tile data must leave the active set');
  await h.succeed(1);
  h.source.request(inside(h.manifest.tiles[0]));
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.source.getBuildings().map(b => b.id), ['building-r0-c0']);
  h.source.request(inside(h.manifest.tiles[15]));
  h.source.request([0, 0, 1, 1]);
  assert.equal(h.requests.length, 2, 'empty and non-intersecting tiles must not fetch');
  assert.equal(h.source.getBuildings().length, 0);
});

test('building tile queue allows at most two concurrent requests and deduplicates repeated views', async t => {
  const h = harness(t, { manifest: buildingManifest({ populated: 4 }) });
  const bounds = [71.2, 51, 71.8, 51.09];
  h.source.request(bounds);
  h.source.request(bounds);
  assert.equal(h.requests.length, 2);
  assert.equal(h.source.getState().pending, 4);
  await h.succeed(1);
  assert.equal(h.requests.length, 3);
  await h.succeed(0);
  assert.equal(h.requests.length, 4);
  await h.succeed(2); await h.succeed(3);
  assert.equal(h.maximum(), 2);
  assert.equal(new Set(h.requests.map(r => r.path)).size, 4);
  assert.deepEqual(h.source.getState(), { total: 4, loadedTiles: 4, pending: 0, failed: 0 });
  assert.equal(h.source.getBuildings().length, 4);
});

test('loaded source footprints replace equal fallback IDs without duplicating buildings', async t => {
  const fallback = [{ id: 'building-r0-c0', height: 1, polygons: [], fallback: true },
    { id: 'fallback-elsewhere', height: 2, polygons: [], fallback: true }];
  const before = structuredClone(fallback);
  const h = harness(t, { fallback });
  h.source.request(inside(h.manifest.tiles[0]));
  await h.succeed(0);
  const buildings = h.source.getBuildings();
  assert.equal(buildings.length, 2);
  assert.equal(buildings.filter(b => b.id === 'building-r0-c0').length, 1);
  assert.equal(buildings.find(b => b.id === 'building-r0-c0').height, 15);
  assert.ok(buildings.find(b => b.id === 'building-r0-c0').polygons[0][0].length > 0);
  assert.equal(buildings.find(b => b.id === 'fallback-elsewhere').fallback, true);
  assert.deepEqual(fallback, before);
});

test('tile failures remain observable and retry only after an explicit request', async t => {
  const failures = [
    request => request.reject(new Error('network failed')),
    request => request.resolve({ ok: false, json: async () => ({}) }),
    request => request.resolve({ ok: true, json: async () => ({ features: [] }) }),
    request => request.resolve({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) }),
    request => request.resolve({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'bad', properties: {}, geometry: { type: 'Point', coordinates: [71.3, 51.1] } }] }) }),
  ];
  for (const fail of failures) {
    const h = harness(t, { manifest: buildingManifest({ populated: 1 }) });
    const bounds = inside(h.manifest.tiles[0]);
    h.source.request(bounds);
    fail(h.requests[0]); await flush();
    assert.deepEqual(h.source.getState(), { total: 1, loadedTiles: 0, pending: 0, failed: 1 });
    assert.equal(h.changes(), 1);
    h.source.request(bounds);
    assert.equal(h.requests.length, 1, 'failed requests cannot loop automatically');
    h.source.retry();
    assert.equal(h.requests.length, 2);
    await h.succeed(1);
    assert.deepEqual(h.source.getState(), { total: 1, loadedTiles: 1, pending: 0, failed: 0 });
    assert.equal(h.changes(), 2);
  }
});

test('destroy aborts owned requests and suppresses late results, callbacks and new requests', async t => {
  const h = harness(t);
  h.source.request([71.2, 51, 71.8, 51.4]);
  assert.equal(h.requests.length, 2);
  assert.ok(h.requests.every(r => r.signal instanceof AbortSignal && !r.signal.aborted));
  h.source.destroy(); h.source.destroy();
  assert.ok(h.requests.every(r => r.signal.aborted));
  await h.succeed(0);
  h.requests[1].reject(new DOMException('Aborted', 'AbortError')); await flush();
  h.source.request([71.2, 51, 71.8, 51.4]); h.source.retry();
  assert.equal(h.requests.length, 2);
  assert.equal(h.changes(), 0);
  assert.deepEqual(h.source.getBuildings(), []);
});

test('manifest rejects incomplete, duplicated, private or inconsistent tile declarations', () => {
  const mutations = [
    manifest => { manifest.tiles.pop(); },
    manifest => { manifest.tiles[1].path = manifest.tiles[0].path; },
    manifest => { manifest.tiles[1].id = manifest.tiles[0].id; },
    manifest => { delete manifest.tiles[0].id; },
    manifest => { manifest.tiles[0].id = 'other'; },
    manifest => { manifest.tiles[0].path = '../private.geojson'; },
    manifest => { manifest.tiles[0].bbox = [71.5, 51, 71.2, 51.4]; },
    manifest => { manifest.featureCount++; },
    manifest => { manifest.featureCount = 0; manifest.tiles.forEach(tile => { tile.featureCount = 0; }); },
  ];
  for (const mutate of mutations) {
    const manifest = buildingManifest(); mutate(manifest);
    assert.throws(() => validateBuildingManifest(manifest), /INVALID_MAP_DATA:buildingManifest/);
  }
});
