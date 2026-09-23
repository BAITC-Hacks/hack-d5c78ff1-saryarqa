import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import analyze from './api/analyze.js';
import { getCapabilities, isSafeFile } from './api/capabilities.js';
import { ASTANA_MAP_FILES, CITY_MAP_FILES } from './scene/load-map.js';

const defaultRoot = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 4096;
const rootFiles = new Map([
  ['/', ['index.html']],
  ['/index.html', ['index.html']],
  ['/styles.css', ['styles.css']],
  ['/app.js', ['app.js']],
  ['/simulator.js', ['simulator.js']],
]);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.geojson', 'application/geo+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
]);
const sceneTypes = new Set(['.js', '.css', '.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif', '.avif']);
const assetTypes = new Set(['.svg', '.png', '.webp', '.json', '.mp3', '.ogg', '.wav', '.m4a', '.aac']);
const atlasDataPaths = new Set([...Object.values(ASTANA_MAP_FILES), ...Object.values(CITY_MAP_FILES).flatMap(Object.values)]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache',
    ...headers,
  });
  res.end(res.req?.method === 'HEAD' ? undefined : body);
}

function parsePath(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.includes('#')) return null;
  const rawPath = rawUrl.split('?', 1)[0];
  if (/%2f|%5c/i.test(rawPath)) return null;
  try {
    const decoded = decodeURIComponent(rawPath);
    if (decoded.includes('%') || decoded.includes('\\') || decoded.includes('\0') || decoded.includes('//')) return null;
    const parts = decoded === '/' ? [] : decoded.slice(1).split('/');
    if (parts.some((part) => !part || part.startsWith('.') || part === '..' || /[\u0000-\u001f\u007f:]/u.test(part))) return null;
    return { pathname: decoded, parts };
  } catch {
    return null;
  }
}

function staticEntry({ pathname, parts }) {
  const fixed = rootFiles.get(pathname);
  if (fixed) return { parts: fixed, type: mime.get(extname(fixed[0])) };
  if (parts.length < 2) return null;
  const extension = extname(parts.at(-1)).toLowerCase();
  if (atlasDataPaths.has(pathname)) return { parts, type: mime.get(extension) };
  if (parts[0] === 'game' && parts.length === 2 && extension === '.js') return { parts, type: mime.get(extension) };
  if (parts[0] === 'scene' && (sceneTypes.has(extension) || pathname === '/scene/dev.html')) return { parts, type: mime.get(extension) };
  if (parts[0] === 'assets' && parts[1] === 'game' && parts.length >= 3 && assetTypes.has(extension)) return { parts, type: mime.get(extension) };
  if (parts[0] === 'data' && ['geography', 'city'].includes(parts[1]) && parts.length === 3 && extension === '.json') return { parts, type: mime.get(extension) };
  return null;
}

async function serveAnalyze(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), 'application/json; charset=utf-8', { Allow: 'POST' });
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        send(res, 413, JSON.stringify({ error: 'REQUEST_TOO_LARGE' }), 'application/json; charset=utf-8');
        return;
      }
      chunks.push(chunk);
    }
    req.body = chunks.length ? Buffer.concat(chunks).toString('utf8') : '{}';
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => {
      if (!res.headersSent) res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify(body));
      return res;
    };
    await analyze(req, res);
  } catch {
    if (!res.writableEnded) send(res, 500, JSON.stringify({ error: 'SERVER_ERROR' }), 'application/json; charset=utf-8');
  }
}

export function createAppServer({ rootDir = defaultRoot } = {}) {
  const root = resolve(rootDir);
  return createServer(async (req, res) => {
    const route = parsePath(req.url);
    if (!route) {
      send(res, 400, 'Bad request');
      return;
    }
    if (route.pathname === '/api/analyze') {
      await serveAnalyze(req, res);
      return;
    }
    if (route.pathname === '/api/capabilities') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(res, 405, JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), 'application/json; charset=utf-8', { Allow: 'GET, HEAD' });
        return;
      }
      const body = JSON.stringify(await getCapabilities(root));
      send(res, 200, body, 'application/json; charset=utf-8', { 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
      return;
    }
    const entry = staticEntry(route);
    if (!entry) {
      send(res, 404, 'Not found');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
      return;
    }
    const compressedParts = atlasDataPaths.has(route.pathname)
      ? [...entry.parts.slice(0, -1), `${entry.parts.at(-1)}.gz`] : null;
    const compressed = compressedParts && await isSafeFile(root, compressedParts);
    if (!compressed && !await isSafeFile(root, entry.parts)) {
      send(res, 404, 'Not found');
      return;
    }
    try {
      let body = await readFile(resolve(root, ...(compressed ? compressedParts : entry.parts)));
      const acceptsGzip = String(req.headers['accept-encoding'] || '').split(',').some(value => {
        const [name, ...parameters] = value.trim().split(';');
        return name === 'gzip' && !parameters.some(p => /^\s*q=0(?:\.0*)?\s*$/.test(p));
      });
      const headers = compressed ? { Vary: 'Accept-Encoding' } : {};
      if (compressed && acceptsGzip) headers['Content-Encoding'] = 'gzip';
      else if (compressed) body = gunzipSync(body);
      send(res, 200, body, entry.type, { ...headers, 'Content-Length': body.length });
    } catch {
      send(res, 404, 'Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createAppServer().listen(port, '127.0.0.1', () => {
    console.log(`Akim simulator: http://localhost:${port}`);
  });
}
