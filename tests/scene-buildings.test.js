import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVisibleBuildings } from '../scene/buildings.js';

const square = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
const building = (id, x, y, size) => ({ id, polygons: [[square(x, y, size)]] });
const ids = entries => entries.map(entry => entry.id);
const select = (entries, viewBounds, pixelsPerWorldUnit = 1, maxCount = 1800) =>
  selectVisibleBuildings(entries, { viewBounds, pixelsPerWorldUnit, maxCount });

test('sparse close views retain small nearby blocks while coarse views retain larger silhouettes', () => {
  const buildings = [building('small', 1, 1, 1), building('medium', 4, 1, 3), building('large', 10, 1, 8)];
  assert.deepEqual(ids(select(buildings, [0, 0, 20, 20])), ['large', 'medium']);
  assert.deepEqual(ids(select(buildings, [0, 0, 20, 20], .3)), ['large']);
  assert.deepEqual(ids(select(buildings, [0, 0, 9, 9], 3)), ['medium', 'small']);
});

test('dense views rank visible area before source order and break equal-area ties by identity', () => {
  const buildings = [building('z', 1, 1, 3), building('a', 5, 1, 3), building('largest', 10, 1, 7),
    building('mostly-offscreen', 19.5, 0, 100)];
  const expected = ['largest', 'mostly-offscreen', 'a'];
  assert.deepEqual(ids(select(buildings, [0, 0, 20, 20], 1, 3)), expected);
  assert.deepEqual(ids(select([...buildings].reverse(), [0, 0, 20, 20], 1, 3)), expected);
  assert.deepEqual(ids(select(buildings, [0, 0, 20, 20], 1, 2)), expected.slice(0, 2));
});

test('viewport selection includes partial intersections and excludes bbox-only empty space', () => {
  const multipart = { id: 'multipart', polygons: [[square(0, 0, 5)], [square(30, 0, 5)]] };
  const courtyard = { id: 'courtyard', polygons: [[square(10, 10, 20), square(13, 13, 14)]] };
  assert.deepEqual(ids(select([multipart], [3, 0, 8, 5])), ['multipart']);
  assert.deepEqual(select([multipart], [10, 0, 25, 5]), []);
  assert.deepEqual(select([courtyard], [15, 15, 25, 25]), []);
  assert.deepEqual(ids(select([courtyard], [10, 10, 13, 25])), ['courtyard']);
  assert.deepEqual(select([multipart], [5, 0, 8, 5]), []);
});

test('large courtyard voids do not outrank buildings with more visible roof area', () => {
  const courtyard = { id: 'mostly-empty', polygons: [[square(0, 0, 20), square(1, 1, 18)]] };
  const solid = building('solid', 25, 0, 10);
  assert.deepEqual(ids(select([courtyard, solid], [-1, -1, 40, 25], 1, 1)), ['solid']);
  const reversed = { ...courtyard, polygons: courtyard.polygons.map(p => p.map(r => [...r].reverse())) };
  assert.deepEqual(select([reversed], [2, 2, 18, 18]), []);
});

test('selection and cached reads preserve source objects, order, vertices and holes', () => {
  const buildings = [building('later', 6, 0, 3), { id: 'holed', polygons: [[square(0, 0, 5), square(1, 1, 1)]] }];
  const original = JSON.stringify(buildings);
  const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } };
  freeze(buildings);
  const first = select(buildings, [-1, -1, 12, 12]);
  const second = select(buildings, [-1, -1, 12, 12]);
  assert.equal(first[0], buildings[1]);
  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  assert.equal(JSON.stringify(buildings), original);
});

test('replacing a loaded feature geometry refreshes its cached bounds and area', () => {
  const source = building('replaceable', 0, 0, 5);
  assert.equal(select([source], [-1, -1, 10, 10]).length, 1);
  source.polygons = [[square(50, 50, 10)]];
  assert.deepEqual(select([source], [-1, -1, 10, 10]), []);
  assert.equal(select([source], [49, 49, 61, 61]).length, 1);
});
