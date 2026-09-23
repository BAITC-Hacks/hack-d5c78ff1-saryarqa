import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeoData, hitTestRoad } from '../scene/geodata.js';
import { pointInRegion } from '../scene/camera.js';

const seed = { working_bbox: { value: [71.220936, 50.999912, 71.728067, 51.301212] }, center: { lon: 71.4304, lat: 51.1282 } };
const fc = (...features) => ({ type: 'FeatureCollection', features });
const feature = (id, type, coordinates, properties = {}) => ({ type: 'Feature', id, geometry: { type, coordinates }, properties });
const ring = (west, south, east, north) => [[west, south], [east, south], [east, north], [west, north], [west, south]];
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('WGS84 round trips and local east/north distances share one aspect-correct scale', () => {
  const data = createGeoData({ seed });
  const [west, south, east, north] = seed.working_bbox.value;
  const cos = Math.cos((south + north) / 2 * Math.PI / 180);
  almost(data.viewBox[3], 1000 * (north - south) / ((east - west) * cos));
  for (const coordinate of [[west, north], [east, south], [71.4256, 51.1283], [seed.center.lon, seed.center.lat]]) {
    const recovered = data.unprojectWorld(data.projectLonLat(coordinate));
    coordinate.forEach((value, index) => almost(recovered[index], value));
  }
  const center = data.projectLonLat([71.43, 51.13]);
  const eastPoint = data.projectLonLat([71.431, 51.13]);
  const northPoint = data.projectLonLat([71.43, 51.13 + 0.001 * cos]);
  almost(eastPoint[0] - center[0], center[1] - northPoint[1]);
  assert.deepEqual(data.center, data.projectLonLat([seed.center.lon, seed.center.lat]));
  assert.equal(data.geographic, true);
});

test('public projection rejects invalid and outside points; invalid/missing bbox cannot invent a map', () => {
  const data = createGeoData({ seed });
  for (const coordinate of [null, [], [NaN, 51], [Infinity, 51], ['71.4', 51.1], [71.1, 51.1], [71.4, 52], [0, 0]]) {
    assert.equal(data.projectLonLat(coordinate), null);
  }
  for (const point of [[-1, 0], [1001, 10], [20, -1], [20, data.viewBox[3] + 1], [NaN, 10]]) {
    assert.equal(data.unprojectWorld(point), null);
  }
  assert.throws(() => createGeoData(), /working bbox/);
  for (const value of [[71, 51, 71, 52], [71, 52, 72, 51], [71, -90, 72, 51], [71, 51, Infinity, 52]]) {
    assert.throws(() => createGeoData({ seed: { working_bbox: { value } } }), /working bbox/);
  }
});

test('missing datasets remain empty; source seed does not fabricate features, district shares or counts', () => {
  const data = createGeoData({ seed: { ...seed, landmarks: [{ id: 'unloaded' }], parks: [{ id: 'unloaded-park' }] } });
  for (const key of ['landmarks', 'parkAnchors', 'roads', 'landscape', 'intersections', 'corridors', 'regions', 'buildings']) assert.deepEqual(data[key], []);
  for (const key of ['landmarks', 'parks', 'roads', 'landscape', 'intersections', 'corridors', 'districts', 'buildings']) assert.equal(data.sourceStatus[key], 'missing');
  for (const key of ['population', 'vehicleCount', 'liveTraffic', 'districtAllocation']) assert.equal(key in data, false);
});

test('landmarks and park anchors preserve source point coordinates and never become park polygons', () => {
  const data = createGeoData({ seed,
    landmarks: fc(feature('baiterek', 'Point', [71.4256, 51.1283], { name: 'Бәйтерек', category: 'landmark', importance: 5, source: 'Seed source', source_url: 'https://example.org/baiterek' })),
    parks: fc(feature('garden', 'Point', [71.41657, 51.10617], { name: 'Ботанический сад' })),
  });
  assert.deepEqual(data.landmarks[0].coordinates, [71.4256, 51.1283]);
  assert.equal(data.landmarks[0].source, 'Seed source');
  assert.equal(data.landmarks[0].sourceUrl, 'https://example.org/baiterek');
  assert.equal(data.parkAnchors[0].category, 'park');
  assert.equal(data.parkAnchors[0].importance, null);
  assert.equal('polygons' in data.parkAnchors[0], false);
  assert.deepEqual(data.landscape, []);
});

test('invalid, duplicate and outside point features are rejected without clamping or guessing', () => {
  const data = createGeoData({ seed, landmarks: fc(
    feature('valid', 'Point', [71.4, 51.1]), feature('valid', 'Point', [71.5, 51.2]),
    feature('outside', 'Point', [72, 52]), feature('invalid', 'Point', [NaN, 51.1]),
    feature('wrong-type', 'Polygon', [ring(71.4, 51.1, 71.5, 51.2)]), feature(null, 'Point', [71.4, 51.1]),
  ) });
  assert.deepEqual(data.landmarks.map(anchor => anchor.id), ['valid']);
  assert.deepEqual(data.diagnostics.landmarks, { accepted: 1, rejected: 5 });
});

test('source lines retain legitimate outer vertices, split MultiLineString parts, and reject invalid geometries', () => {
  const data = createGeoData({ seed, roads: fc(
    feature('crossing', 'LineString', [[71.1, 51.1], [71.4, 51.1], [71.8, 51.1]], { name: 'реальная дорога', sourceId: 'municipal' }),
    feature('multi', 'MultiLineString', [[[71.4, 51.1], [71.5, 51.1]], [[71.4, 51.2], [71.5, 51.2]]]),
    feature('outside', 'LineString', [[72, 52], [73, 53]]),
    feature('invalid', 'LineString', [[71.4, 51.1], [NaN, 51.2], [71.5, 51.2]]),
  ) });
  assert.deepEqual(data.roads.map(road => road.id), ['crossing', 'multi:part:0', 'multi:part:1']);
  assert.ok(data.roads[0].points[0][0] < 0);
  assert.ok(data.roads[0].points.at(-1)[0] > 1000);
  assert.equal(data.roads[0].illustrative, false);
  assert.deepEqual(data.roads[0].sourceIds, ['municipal']);
  assert.equal(data.roads[0].importance, null);
  assert.deepEqual(data.diagnostics.roads, { accepted: 2, rejected: 2 });
});

test('landscape holes/multipolygons and source building footprints survive projection', () => {
  const outer = ring(71.35, 51.05, 71.55, 51.25), hole = ring(71.4, 51.1, 71.45, 51.15);
  const data = createGeoData({ seed,
    landscape: fc(feature('river', 'MultiPolygon', [[outer, hole], [ring(71.6, 51.1, 71.65, 51.15)]], { kind: 'water', sourceId: 'river-source' })),
    buildings: fc(feature('building', 'Polygon', [ring(71.43, 51.12, 71.44, 51.13)], { name: 'Здание', NAME_OBJECT: 'Source landmark', details: { sourceHeightUnknown: true } })),
  });
  assert.equal(data.landscape[0].polygons.length, 2);
  assert.equal(data.landscape[0].polygons[0].length, 2);
  assert.deepEqual(data.landscape[0].polygons[0][1], hole.map(data.projectLonLat));
  assert.equal(data.buildings[0].height, null);
  assert.equal(data.buildings[0].levels, null);
  assert.equal(data.buildings[0].label, 'Source landmark');
  assert.equal(data.buildings[0].polygons[0][0].length, 5);
});

test('districts use exact identities and interior anchors outside holes without synthesizing missing regions', () => {
  const outer = ring(71.35, 51.05, 71.55, 51.25), hole = ring(71.4, 51.1, 71.5, 51.2);
  const districts = fc(
    feature('old-almaty', 'Polygon', [outer, hole], { name: 'район "Алматы"', sourceId: 'historical-source' }),
    feature('name-contains', 'Polygon', [outer], { name: 'Алматы новая территория' }),
    feature('unrelated', 'Polygon', [outer], { name: 'Новая область' }),
  );
  districts.metadata = { boundaryCurrency: 'outdated-four-districts' };
  const data = createGeoData({ seed, districts });
  assert.deepEqual(data.regions.map(region => region.regionId), ['almaty']);
  assert.equal(data.regions[0].status, 'historical');
  assert.equal(data.regions[0].simulationDistrict, 'Алматы');
  assert.ok(pointInRegion(data.regions[0].labelAnchor, data.regions[0]));
  assert.deepEqual(data.regions[0].sourceIds, ['historical-source']);
  assert.deepEqual(data.regions[0].sourceFeatureIds, ['old-almaty']);
  assert.equal(data.sourceStatus.districtBoundaryCurrency, 'outdated-four-districts');
});

test('historical corridors resolve explicit full-road aliases only and do not invent exact segments or live traffic', () => {
  const data = createGeoData({ seed,
    majorRoads: [{ id: 'turan', name: 'Тұран даңғылы', importance: 5 }],
    roads: fc(
      feature('turan-1', 'LineString', [[71.4, 51.1], [71.5, 51.2]], { name: '  ПРОСП.   ТУРАН  ' }),
      feature('different', 'LineString', [[71.4, 51.1], [71.5, 51.2]], { name: 'Туран переулок новый' }),
    ),
    trafficCorridors: [
      { id: 'corridor', road: 'Тұран даңғылы', from: 'Парк «Нұр-Сұлтан»', to: 'Қорғалжын тас жолы', importance_0_1: 0.8924, historical_load_score: 89.242 },
      { id: 'unresolved', road: 'Туран', from: 'A', to: 'B' },
    ],
  });
  assert.deepEqual(data.corridors[0].roadIds, ['turan-1']);
  assert.equal(data.corridors[0].resolution, 'road-only');
  assert.equal(data.corridors[0].segmentResolved, false);
  assert.deepEqual(data.corridors[0].unresolvedEndpoints, ['Парк «Нұр-Сұлтан»', 'Қорғалжын тас жолы']);
  assert.equal(data.corridors[0].historicalLoadScore, 89.242);
  assert.equal(data.corridors[0].live, false);
  assert.equal(data.corridors[0].historical, true);
  assert.deepEqual(data.corridors[1].roadIds, []);
  assert.equal(data.corridors[1].resolution, 'unresolved');
  assert.equal(data.roads[0].importance, 5);
  assert.equal(data.roads[0].historical, true);
  assert.equal(data.roads[1].historical, undefined);
});

test('intersections preserve given road names and source ranking without fabricating counts', () => {
  const data = createGeoData({ seed, intersections: fc(feature('intersection', 'Point', [71.4, 51.1], {
    roads: ['Республика даңғылы', 'Кенесары көшесі', 'Кенесары көшесі'], importance_score: 28, sourceId: 'osm-intersections',
  })) });
  assert.deepEqual(data.intersections[0].roads, ['Республика даңғылы', 'Кенесары көшесі']);
  assert.equal(data.intersections[0].importance, 28);
  assert.equal('trafficCount' in data.intersections[0], false);
});

test('road picking uses segment distance, endpoints, and supplied world tolerance', () => {
  const road = { points: [[0, 0], [10, 0], [10, 10]] };
  assert.equal(hitTestRoad([5, 1], road, 1), true);
  assert.equal(hitTestRoad([5, 2], road, 1), false);
  assert.equal(hitTestRoad([-1, 0], road, 1), true);
  assert.equal(hitTestRoad([5, 5], road, 1), false);
  assert.equal(hitTestRoad([10, 10], road, 0), true);
  assert.equal(hitTestRoad([NaN, 10], road, 1), false);
  assert.equal(hitTestRoad([1, 1], road, -1), false);
});

test('frozen input datasets remain untouched and returned geometry/properties do not alias source objects', () => {
  const input = freeze({ seed, buildings: fc(feature('b', 'Polygon', [ring(71.4, 51.1, 71.5, 51.2)], { details: { height: null }, sourceId: 'municipal' })),
    landmarks: fc(feature('anchor', 'Point', [71.4, 51.1], { name: 'Anchor' })) });
  const before = JSON.stringify(input);
  const data = createGeoData(input);
  data.buildings[0].properties.details.height = 30;
  data.buildings[0].polygons[0][0][0][0] = 999;
  data.landmarks[0].coordinates[0] = 10;
  data.bounds[0] = 0;
  assert.equal(JSON.stringify(input), before);
});
