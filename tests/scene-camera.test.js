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
