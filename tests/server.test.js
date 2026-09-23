import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createAppServer } from '../server.js';
import { getCapabilities } from '../api/capabilities.js';
import { ASTANA_MAP_FILES, BUILDING_TILE_PATHS } from '../scene/load-map.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'akim-http-'));
  async function put(path, body) {
    const file = join(root, ...path.split('/'));
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, body);
  }
  await put('index.html', '<h1>Game</h1>');
  await put('styles.css', 'body{}');
  await put('app.js', 'export const app = true;');
  await put('simulator.js', 'export const score = 1;');
  await put('game/session.js', 'export const session = true;');
  await put('scene/dev.html', '<h1>Scene</h1>');
  await put('scene/styles.css', '.scene{}');
  await put('scene/fixtures/sample.png', Buffer.from([137, 80, 78, 71]));
  await put('assets/game/icon.svg', '<svg></svg>');
  await put('assets/game/sound.ogg', Buffer.from([1, 2, 3]));
  await put('data/geography/fixture.json', '{}');
  await put('data/city/fixture.json', '{}');
  await put('.env', 'SECRET=private');
  await put('docs/internal.txt', 'private');
  await put('.codex-private/secret.json', '{}');
  await put('package.json', '{}');
  return { root, put };
}

async function withServer(run) {
  const { root, put } = await fixture();
  const server = createAppServer({ rootDir: root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const hit = (path, method = 'GET', body) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
  try {
    await run({ root, put, hit });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

test('serves only approved root and resource paths with correct MIME and HEAD behavior', async () => {
  await withServer(async ({ hit }) => {
    const cases = [
      ['/', 'text/html'],
      ['/styles.css', 'text/css'],
      ['/app.js', 'text/javascript'],
      ['/game/session.js', 'text/javascript'],
      ['/scene/dev.html', 'text/html'],
      ['/scene/styles.css', 'text/css'],
      ['/scene/fixtures/sample.png', 'image/png'],
      ['/assets/game/icon.svg', 'image/svg+xml'],
      ['/assets/game/sound.ogg', 'audio/ogg'],
      ['/data/geography/fixture.json', 'application/json'],
      ['/data/city/fixture.json', 'application/json'],
    ];
    for (const [path, contentType] of cases) {
      const get = await hit(path);
      assert.equal(get.status, 200, path);
      assert.ok(get.headers['content-type'].startsWith(contentType), path);
      assert.equal(get.headers['x-content-type-options'], 'nosniff');
      const head = await hit(path, 'HEAD');
      assert.equal(head.status, 200, `${path} HEAD`);
      assert.equal(head.headers['content-type'], get.headers['content-type']);
      assert.equal(head.headers['content-length'], get.headers['content-length']);
      assert.equal(head.body, '');
    }
  });
});

test('denies private, unsupported, malformed and traversal targets', async () => {
  await withServer(async ({ hit }) => {
    const denied = [
      '/.env', '/package.json', '/docs/internal.txt', '/.codex-private/secret.json',
      '/api/analyze.js', '/scene/hidden.html', '/game/nested/module.js',
      '/assets/game/../.env', '/assets/game/%2e%2e/.env',
      '/assets/game/%2f.env', '/assets/game/%5c.env',
      '/assets/game/%252e%252e/.env', '/assets/game/.hidden.svg',
      '/assets/game/bad%ZZ.svg', '/assets\\game\\icon.svg',
    ];
    for (const path of denied) {
      const response = await hit(path);
      assert.ok(response.status === 400 || response.status === 404, `${path}: ${response.status}`);
      assert.equal(response.headers['x-content-type-options'], 'nosniff', path);
    }
    const wrongMethod = await hit('/game/session.js', 'POST');
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.allow, 'GET, HEAD');
    assert.equal((await hit('/game/missing.js')).status, 404);
  });
});

test('capabilities report expected regular resources and update when present', async () => {
  await withServer(async ({ root, put, hit }) => {
    const empty = { scene: false, assets: false, geography: false, cityData: false, atlas: false };
    assert.deepEqual(JSON.parse((await hit('/api/capabilities')).body), empty);
    assert.deepEqual(await getCapabilities(root), empty);
    await put('scene/index.js', 'export function createScene() {}');
    await put('assets/game/manifest.json', '{}');
    await put('data/geography/astana.json', '{}');
    await put('data/city/context.json', '{}');
    const response = await hit('/api/capabilities');
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(response.body), { scene: true, assets: true, geography: true, cityData: true, atlas: false });
    const head = await hit('/api/capabilities', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal((await hit('/api/capabilities', 'POST')).status, 405);
  });
});

test('atlas exposes only its declared data files with GeoJSON MIME and HEAD support', async () => {
  await withServer(async ({ put, hit }) => {
    for (const path of [...Object.values(ASTANA_MAP_FILES), ...BUILDING_TILE_PATHS]) {
      await put(path.slice(1), '{}');
      const response = await hit(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers['content-type'], path.endsWith('.geojson')
        ? 'application/geo+json; charset=utf-8' : 'application/json; charset=utf-8');
      const head = await hit(path, 'HEAD');
      assert.equal(head.status, 200, path);
      assert.equal(head.body, '');
      assert.equal(head.headers['content-length'], response.headers['content-length']);
    }
    for (const filename of ['private.json', 'buildings.geojson', 'districts.geojson', 'osm-major-roads-response.json', 'traffic_corridors.csv', 'buildings-tiles/r4-c0.geojson', 'buildings-tiles/r0-c4.geojson', 'buildings-tiles/r00-c0.geojson', 'buildings-tiles/private.geojson', 'buildings-tiles/r0-c0.json']) {
      const path = `/scene/data/astana/${filename}`;
      await put(path.slice(1), '{}');
      assert.equal((await hit(path)).status, 404, path);
    }
  });
});

test('atlas readiness requires every render resource independently of legacy assets and geography', async () => {
  await withServer(async ({ root, put, hit }) => {
    for (const path of ['index.js', 'atlas.js', 'atlas.css', 'styles.css', 'load-map.js', 'geodata.js', 'camera.js', 'building-tiles.js', 'buildings.js']) {
      await put(`scene/${path}`, '');
    }
    const paths = [...Object.values(ASTANA_MAP_FILES), ...BUILDING_TILE_PATHS];
    for (const path of paths.slice(0, -1)) await put(path.slice(1), '{}');
    assert.equal((await getCapabilities(root)).atlas, false);
    await put(paths.at(-1).slice(1), '{}');
    const capabilities = JSON.parse((await hit('/api/capabilities')).body);
    assert.equal(capabilities.atlas, true);
    assert.equal(capabilities.assets, false);
    assert.equal(capabilities.geography, false);
    for (const required of ['scene/buildings.js', 'scene/building-tiles.js', ...[...Object.values(ASTANA_MAP_FILES), ...BUILDING_TILE_PATHS].map(path => path.slice(1))]) {
      await rm(join(root, required));
      assert.equal((await getCapabilities(root)).atlas, false, required);
      await put(required, '');
    }
    await rm(join(root, paths.at(-1).slice(1)));
    await symlink(join(root, 'index.html'), join(root, paths.at(-1).slice(1)));
    assert.equal((await getCapabilities(root)).atlas, false);
    assert.equal((await hit(paths.at(-1))).status, 404);
  });
});

test('symlinked files cannot escape an approved namespace', async (t) => {
  await withServer(async ({ root, hit }) => {
    try {
      await symlink(join(root, '.env'), join(root, 'assets', 'game', 'secret.svg'));
    } catch (cause) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(cause.code)) {
        t.skip(`symlink creation unavailable: ${cause.code}`);
        return;
      }
      throw cause;
    }
    assert.equal((await hit('/assets/game/secret.svg')).status, 404);
  });
});

test('analyze route retains plan validation and request size cap without external calls', async () => {
  await withServer(async ({ hit }) => {
    const invalid = await hit('/api/analyze', 'POST', JSON.stringify({ plan: [] }));
    assert.equal(invalid.status, 422);
    assert.equal(JSON.parse(invalid.body).error, 'INVALID_PLAN');
    const large = await hit('/api/analyze', 'POST', JSON.stringify({ plan: [], noise: 'x'.repeat(5000) }));
    assert.equal(large.status, 413);
    assert.equal((await hit('/api/analyze')).status, 405);
  });
});
