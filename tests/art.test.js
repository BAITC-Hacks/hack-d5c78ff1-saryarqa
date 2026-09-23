import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ART_INVENTORY, ART_FAMILIES, ART_STYLESHEET, assetArt, policyArt, actorArt, worldArt, effectArt, iconArt, faviconArt } from '../game/art.js';
import { safeFile, inspectSvg } from '../tools/check-assets.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const exportedFiles = (folder) => readdirSync(new URL(`../${folder}/`, import.meta.url), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? exportedFiles(`${folder}/${entry.name}`)
    : /\.(svg|png|css)$/.test(entry.name) ? [`${folder}/${entry.name}`] : []);

test('lazy registry covers every usable producer export, excluding source archives and duplicate masters', () => {
  assert.deepEqual(ART_INVENTORY.map(entry => entry.path).sort(), exportedFiles('assets/exports').sort());
  assert.equal(new Set(ART_INVENTORY.map(entry => entry.path)).size, ART_INVENTORY.length);
  assert.deepEqual([...ART_FAMILIES].sort(), ['buildings', 'characters', 'effects', 'favicon', 'icons', 'policies', 'style', 'vehicles', 'world']);
  assert.equal(assetArt(ART_STYLESHEET).type, 'stylesheet');
  assert.ok(ART_INVENTORY.every(entry => entry.href === `/${entry.path}`));
  assert.equal(assetArt('../sources/style/palette.svg'), null);
  assert.equal(assetArt('https://example.org/image.svg'), null);
});

test('every image resolves with exact filename case, actual dimensions and safe SVG contents', () => {
  for (const art of ART_INVENTORY) {
    const bytes = readFileSync(safeFile(root, art.path));
    if (art.type === 'stylesheet') continue;
    if (art.path.endsWith('.png')) {
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), art.width, art.path);
      assert.equal(bytes.readUInt32BE(20), art.height, art.path);
    } else {
      const svg = bytes.toString('utf8');
      inspectSvg(svg);
      const box = svg.match(/viewBox=["']([^"']+)/)[1].split(/\s+/).map(Number);
      assert.deepEqual(box, [0, 0, art.width, art.height], art.path);
    }
    assert.ok(art.anchor[0] >= 0 && art.anchor[0] <= art.width && art.anchor[1] >= 0 && art.anchor[1] <= art.height, art.path);
    assert.ok(Object.isFrozen(art) && Object.isFrozen(art.anchor));
    for (const [x, y, width, height] of art.frameRects || []) {
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= art.width && y + height <= art.height, art.path);
    }
  }
});

test('all 14 measures expose separate icon, ground object and map marker with producer anchors', () => {
  for (let n = 1; n <= 14; n++) {
    const icon = policyArt(`M${n}`), object = policyArt(`M${n}`, 'object'), marker = policyArt(`M${n}`, 'marker');
    assert.deepEqual(icon.anchor, [32, 32]);
    assert.deepEqual(marker.anchor, [32, 77]);
    assert.deepEqual(object.anchor, [80, n <= 7 ? 110 : 118]);
    assert.equal(new Set([icon.path, object.path, marker.path]).size, 3);
  }
  assert.equal(policyArt('M01'), policyArt('M1'));
  assert.equal(policyArt('M15'), null);
  assert.equal(policyArt('M1', 'unknown'), null);
});

test('actors select actual directional stills; sheets expose poses without claiming animation cycles', () => {
  for (const kind of ['bus', 'car', 'lrt', 'service']) {
    for (const [degrees, direction] of [[0, 'right'], [90, 'down'], [180, 'left'], [-90, 'up'], [360, 'right']]) {
      assert.ok(actorArt(kind, 'top', degrees).path.endsWith(`/top/${direction}/frame-01.png`));
    }
    assert.deepEqual(actorArt(kind, 'tilted').anchor, [128, 240]);
    const atlas = actorArt(kind, 'top', 0, 'atlas');
    assert.equal(atlas.frameRects.length, 5);
    assert.deepEqual(atlas.frameAnchors[4], [128, 240]);
  }
  for (const kind of ['mayor', 'person', 'citizen-02', 'citizen-03', 'worker', 'emergency']) {
    assert.deepEqual(actorArt(kind).anchor, [64, 124]);
    assert.equal(actorArt(kind).width, 128);
    const sheet = actorArt(kind, 'tilted', 0, 'sheet');
    assert.equal(sheet.frameRects.length, 4);
    assert.equal(sheet.frameLabels.length, 4);
    assert.equal(sheet.fps, undefined);
  }
  assert.equal(actorArt('vehicle.service'), actorArt('service'));
  assert.equal(actorArt('unit.citizen.03'), actorArt('citizen-03'));
  assert.equal(actorArt('spaceship'), null);
});

test('world helpers preserve paired views and exact ground anchors; UI families remain accessible', () => {
  assert.deepEqual(worldArt('tree-02', 'tilted').anchor, [160, 176]);
  assert.deepEqual(worldArt('terrain.grass', 'tilted').anchor, [160, 148]);
  assert.deepEqual(worldArt('building.school', 'tilted').anchor, [64, 112]);
  for (const key of ['home', 'apartment', 'civic', 'school', 'clinic', 'bus-stop', 'lrt-station-track', 'sports-court', 'utility-cue', 'road.junction', 'road.crosswalk', 'bridge', 'bench', 'river-water', 'shrub-02', 'shadow-canopy']) {
    for (const projection of ['top', 'tilted']) assert.ok(worldArt(key, projection), `${key}/${projection}`);
  }
  assert.equal(worldArt('unknown'), null);
  assert.ok(effectArt('negative-tradeoff'));
  assert.ok(iconArt('hud-budget'));
  assert.equal(faviconArt(32).width, 32);
  assert.equal(faviconArt(123), null);
});

test('stable scene manifest points entirely at approved exports with matching registry metadata', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/game/manifest.json', import.meta.url), 'utf8'));
  for (const item of manifest.assets) {
    assert.equal(item.status, 'ready', item.id);
    for (const view of Object.values(item.views)) {
      const art = assetArt(view.path);
      assert.ok(art, item.id);
      assert.deepEqual(view.anchor, art.anchor, item.id);
      assert.equal(view.width, art.width, item.id);
      assert.equal(view.height, art.height, item.id);
    }
  }
});
