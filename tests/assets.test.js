import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { safeFile, inspectSvg, requiredAssetIds, validateManifest } from '../tools/check-assets.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../assets/game/manifest.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(manifest);
const firstView = data => Object.values(data.assets.find(asset => Object.keys(asset.views).length).views)[0];

test('actual manifest resolves every required stable ID and every supplied view', () => {
  assert.equal(validateManifest(manifest, root), true);
  const ids = new Set(manifest.assets.map(asset => asset.id));
  for (const id of requiredAssetIds) assert.ok(ids.has(id), id);
});

test('asset file paths reject traversal, absolute paths and filename case changes', () => {
  assert.ok(safeFile(root, 'assets/game/manifest.json'));
  for (const path of ['../package.json', 'assets/../package.json', '/assets/game/manifest.json', 'C:/assets/game/manifest.json', 'assets\\game\\manifest.json', 'assets//game/manifest.json', 'assets/game/Manifest.json']) {
    assert.throws(() => safeFile(root, path), undefined, path);
  }
});

test('SVG gate accepts local symbols and rejects active or external content', () => {
  assert.deepEqual(inspectSvg('<svg><defs><path id="shape"/></defs><use href="#shape"/></svg>'), ['shape']);
  for (const content of [
    '<script>alert(1)</script>', '<g onload="alert(1)"/>', '<foreignObject/>',
    '<use href="https://example.org/art.svg#shape"/>', '<use xlink:href="//example.org/art.svg"/>',
    '<path fill="url(https://example.org/paint.svg#gradient)"/>', '<style>@import "https://example.org/style.css";</style>',
    '<use href="data:image/svg+xml;base64,AAAA"/>', '<use href="#unknown"/>',
    '<path id="duplicate"/><g id="duplicate"/>',
  ]) assert.throws(() => inspectSvg(`<svg>${content}</svg>`), undefined, content);
});

test('manifest rejects duplicate IDs, missing required IDs and unregistered provenance', () => {
  let data = copy();
  data.assets.push(structuredClone(data.assets[0]));
  assert.throws(() => validateManifest(data, root), /asset ID/i);
  data = copy();
  data.assets = data.assets.filter(asset => asset.id !== 'measure.M14');
  assert.throws(() => validateManifest(data, root), /required asset/i);
  data = copy();
  data.assets[0].sourceId = 'unknown-source';
  assert.throws(() => validateManifest(data, root), /source/i);
});

test('missing assets require an explicit reason and must not invent views', () => {
  const data = copy();
  data.assets[0].status = 'missing';
  assert.throws(() => validateManifest(data, root), /Missing asset/i);
  data.assets[0].views = {};
  data.assets[0].note = '';
  assert.throws(() => validateManifest(data, root), /Missing asset/i);
  data.assets[0].note = 'No reviewed export supplied.';
  assert.equal(validateManifest(data, root), true);
});

test('manifest view dimensions and anchors must match usable image geometry', () => {
  for (const mutate of [
    view => { delete view.width; },
    view => { view.width = -1; },
    view => { view.height += 1; },
    view => { delete view.anchor; },
    view => { view.anchor = [view.width + 1, 0]; },
    view => { view.anchor = [0, -1]; },
  ]) {
    const data = copy();
    mutate(firstView(data));
    assert.throws(() => validateManifest(data, root), /dimensions|anchor/i);
  }
});

test('a referenced SVG symbol must exist in the supplied file', () => {
  const data = copy();
  firstView(data).symbolId = 'missing-symbol';
  assert.throws(() => validateManifest(data, root), /symbol/i);
});

test('animation frames stay inside the image and require positive timing', () => {
  const data = copy();
  const view = firstView(data);
  view.frames = [[0, 0, view.width, view.height]];
  view.fps = 8;
  assert.equal(validateManifest(data, root), true);
  for (const frame of [[-1, 0, 1, 1], [0, 0, 0, 1], [1, 0, view.width, 1], [0, view.height, 1, 1], [0, 0, 1]]) {
    view.frames = [frame];
    assert.throws(() => validateManifest(data, root), /Frame/i);
  }
  view.frames = [[0, 0, 1, 1]];
  view.fps = 0;
  assert.throws(() => validateManifest(data, root), /animation/i);
});
