import { lstat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASTANA_MAP_FILES } from '../scene/load-map.js';

const defaultRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Check a known repository file without following any symlink in its path. */
export async function isSafeFile(rootDir, parts) {
  const root = resolve(rootDir);
  if (!Array.isArray(parts) || parts.length === 0 || parts.some((part) =>
    typeof part !== 'string' || !part || part === '.' || part === '..' ||
    part.startsWith('.') || part.includes('/') || part.includes('\\') || part.includes('\0') || isAbsolute(part))) {
    return false;
  }
  const candidate = resolve(root, ...parts);
  const within = relative(root, candidate);
  if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) return false;
  let current = root;
  try {
    for (let i = 0; i < parts.length; i += 1) {
      current = join(current, parts[i]);
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) return false;
      if (i < parts.length - 1 && !entry.isDirectory()) return false;
      if (i === parts.length - 1 && !entry.isFile()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getCapabilities(rootDir = defaultRoot) {
  const entries = [
    ['scene', ['scene', 'index.js']],
    ['assets', ['assets', 'game', 'manifest.json']],
    ['geography', ['data', 'geography', 'astana.json']],
    ['cityData', ['data', 'city', 'context.json']],
  ];
  const checks = await Promise.all(entries.map(async ([key, parts]) => [key, await isSafeFile(rootDir, parts)]));
  const atlasFiles = [
    '/scene/index.js', '/scene/atlas.js', '/scene/atlas.css', '/scene/styles.css',
    '/scene/load-map.js', '/scene/geodata.js', '/scene/camera.js',
    ...Object.values(ASTANA_MAP_FILES),
  ];
  const atlas = (await Promise.all(atlasFiles.map(path => isSafeFile(rootDir, path.slice(1).split('/'))))).every(Boolean);
  return { ...Object.fromEntries(checks), atlas };
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const body = await getCapabilities();
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', Buffer.byteLength(JSON.stringify(body)));
    return res.status(200).end();
  }
  return res.status(200).json(body);
}
