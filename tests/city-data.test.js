import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { districts, validDate, validateContext, validateGeography, inPolygons } from '../tools/check-assets.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const geography = read('../data/geography/astana.json');
const copyGeo = () => structuredClone(geography);
// Isolated schema fixture; these are test values, never runtime city observations.
const contextFixture = () => ({
  schemaVersion: 1,
  sources: [{ id: 'test-source', publisher: 'Test publisher', url: 'https://example.org/report', referenceDate: null, publishedAt: null, retrievedAt: '2026-09-23', location: 'Test table', reuse: 'Test fixture' }],
  observations: [{ id: 'test-population', metric: 'population', regionId: 'city', value: 100, unit: 'persons', asOf: '2026-09-01', sourceId: 'test-source', definition: 'Test resident count', status: 'verified', note: 'Synthetic validation fixture.' }],
});

test('actual city observations and geography pass the published contracts', () => {
  assert.equal(validateContext(read('../data/city/context.json')), true);
  assert.equal(validateGeography(geography), true);
});

test('calendar dates reject impossible days while accepting explicit period precision', () => {
  for (const date of ['2024-02-29', '2026-09-23', '2026-09', '2026']) assert.equal(validDate(date), true, date);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13', '2026-00-10', '2026-9-1', 'tomorrow', '', null]) assert.equal(validDate(date), false, String(date));
  const data = contextFixture();
  data.observations[0].asOf = '2026-09';
  assert.throws(() => validateContext(data), /precision/i);
  data.observations[0].note = 'Monthly date precision; no exact day supplied.';
  assert.equal(validateContext(data), true);
});

test('source metadata requires distinct IDs, dates, location and attribution', () => {
  for (const mutate of [
    data => data.sources.push(structuredClone(data.sources[0])),
    data => { data.sources[0].retrievedAt = '2026-02-30'; },
    data => { data.sources[0].publishedAt = 'unknown'; },
    data => { data.sources[0].referenceDate = '2026-15'; },
    data => { data.sources[0].location = ''; },
    data => { data.sources[0].reuse = ''; },
    data => { data.sources[0].url = 'not-a-url'; },
  ]) {
    const data = contextFixture(); mutate(data);
    assert.throws(() => validateContext(data), /source/i);
  }
});

test('verified values require evidence; unavailable is null rather than zero', () => {
  for (const property of ['value', 'asOf', 'sourceId']) {
    const data = contextFixture(); data.observations[0][property] = null;
    assert.throws(() => validateContext(data), /verified/i);
  }
  const data = contextFixture();
  Object.assign(data.observations[0], { value: null, asOf: null, sourceId: null, status: 'unavailable', note: 'No district count was located.' });
  assert.equal(validateContext(data), true);
  data.observations[0].value = 0;
  assert.throws(() => validateContext(data), /null/i);
  Object.assign(data.observations[0], { value: 0, asOf: '2026-09-01', sourceId: 'test-source', status: 'verified' });
  assert.equal(validateContext(data), true);
});

test('observation IDs, scopes, statuses, metrics and units cannot silently drift', () => {
  for (const change of [{ regionId: 'unknown' }, { metric: 'buses' }, { unit: 'vehicles' }, { status: 'estimated' }, { sourceId: 'unknown' }, { value: -1 }, { value: '100' }, { asOf: '2026-02-30' }, { note: '' }]) {
    const data = contextFixture(); Object.assign(data.observations[0], change);
    assert.throws(() => validateContext(data));
  }
  const data = contextFixture(); data.observations.push(structuredClone(data.observations[0]));
  assert.throws(() => validateContext(data), /observation ID/i);
  for (const [metric, unit] of Object.entries({ bus_fleet_stock: 'vehicles', buses_active_daily: 'vehicles', bus_routes: 'routes', lrt_daily_ridership: 'trips/day' })) {
    const valid = contextFixture(); Object.assign(valid.observations[0], { metric, unit });
    assert.equal(validateContext(valid), true);
  }
});

test('all six mappings are exact and Saraishyk remains outside the five scored districts', () => {
  assert.deepEqual(districts, { esil: 'Есиль', almaty: 'Алматы', saryarka: 'Сарыарка', baikonur: 'Байконур', nura: 'Нура', saraishyk: null });
  assert.deepEqual(Object.fromEntries(geography.regions.map(r => [r.regionId, r.simulationDistrict])), districts);
  let data = copyGeo(); data.regions.find(r => r.regionId === 'saraishyk').simulationDistrict = 'Сарайшық';
  assert.throws(() => validateGeography(data), /mapping/i);
  data = copyGeo(); data.regions.pop();
  assert.throws(() => validateGeography(data), /six/i);
  data = copyGeo(); data.regions[1] = structuredClone(data.regions[0]);
  assert.throws(() => validateGeography(data), /district/i);
});

test('geography cannot become verified without a boundary date and provenance', () => {
  let data = copyGeo(); Object.assign(data, { status: 'verified', boundaryDate: null });
  assert.throws(() => validateGeography(data), /boundary date/i);
  data = copyGeo(); data.sources = [];
  assert.throws(() => validateGeography(data), /source/i);
  data = copyGeo(); data.boundaryDate = '2026-02-30';
  assert.throws(() => validateGeography(data), /date/i);
});

test('actual rings are closed and labels are inside their own polygons', () => {
  for (const region of geography.regions) {
    assert.equal(inPolygons(region.labelAnchor, region.polygons), true, region.regionId);
    for (const polygon of region.polygons) for (const ring of polygon) assert.deepEqual(ring[0], ring.at(-1));
  }
  let data = copyGeo(); data.regions[0].polygons[0][0].pop();
  assert.throws(() => validateGeography(data), /closed/i);
  data = copyGeo(); data.regions[0].labelAnchor = [-1, -1];
  assert.throws(() => validateGeography(data), /Label/i);
});

const square = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
test('holes exclude labels while disjoint multipolygon parts remain valid', () => {
  const data = copyGeo();
  const region = data.regions[0];
  region.polygons = [[square(100, 100, 100), square(130, 130, 20)], [square(300, 300, 100)]];
  region.labelAnchor = [110, 110];
  assert.equal(validateGeography(data), true);
  region.labelAnchor = [350, 350];
  assert.equal(validateGeography(data), true);
  region.labelAnchor = [140, 140];
  assert.throws(() => validateGeography(data), /Label/i);
  region.labelAnchor = [110, 110];
  region.polygons[0][1] = square(250, 250, 10);
  assert.throws(() => validateGeography(data), /Hole/i);
});

test('a hole cannot cross the exterior even when its first point is inside', () => {
  const data = copyGeo();
  data.regions[0].polygons = [[square(100, 100, 100), square(180, 180, 50)]];
  data.regions[0].labelAnchor = [110, 110];
  assert.throws(() => validateGeography(data), /Hole/i);
});

test('hole edges cannot bridge the outside notch of a concave exterior', () => {
  const data = copyGeo();
  const outer = [[100, 100], [200, 100], [200, 200], [170, 200], [170, 140], [130, 140], [130, 200], [100, 200], [100, 100]];
  const hole = [[120, 160], [180, 160], [150, 120], [120, 160]];
  data.regions[0].polygons = [[outer, hole]];
  data.regions[0].labelAnchor = [110, 110];
  assert.throws(() => validateGeography(data), /Hole/i);
});

test('geography rejects out of bounds geometry and unsourced real routes', () => {
  const data = copyGeo();
  data.paths = [{ id: 'test-route', kind: 'road', points: [[100, 100], [200, 200]], sourceIds: [], illustrative: true }];
  assert.equal(validateGeography(data), true);
  data.paths[0].illustrative = false;
  assert.throws(() => validateGeography(data), /source/i);
  data.paths[0].sourceIds = [data.sources[0].id];
  assert.equal(validateGeography(data), true);
  data.paths[0].points[1] = [data.viewBox[0] + data.viewBox[2] + 1, 100];
  assert.throws(() => validateGeography(data), /geometry/i);
});
