import { readFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const districts = { esil: 'Есиль', almaty: 'Алматы', saryarka: 'Сарыарка', baikonur: 'Байконур', nura: 'Нура', saraishyk: null };
const indicators = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'];
export const requiredAssetIds = [
  ...Array.from({ length: 14 }, (_, i) => `measure.M${i + 1}`),
  ...['transport', 'ecology', 'social', 'safety', 'services'].map(id => `category.${id}`),
  ...indicators.map(id => `indicator.${id}`),
  ...['mayor', 'citizen.01', 'citizen.02', 'citizen.03', 'worker', 'emergency'].map(id => `unit.${id}`),
  ...['car', 'bus', 'lrt', 'service'].map(id => `vehicle.${id}`),
  ...['home', 'apartment', 'civic', 'school', 'clinic'].map(id => `building.${id}`),
  'terrain.tree', 'terrain.park', 'road.straight', 'road.corner', 'road.junction', 'road.crosswalk',
];
const check = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)) return false;
  const full = value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${full}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === full;
}
export function safeFile(root, path) {
  check(typeof path === 'string' && /^[A-Za-z0-9_./-]+$/.test(path), `Unsafe path: ${path}`);
  const parts = path.split('/');
  check(parts.every(p => p && p !== '.' && p !== '..' && !p.endsWith('.') && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p)), `Unsafe path: ${path}`);
  let current = resolve(root);
  for (const part of parts) {
    check(readdirSync(current).includes(part), `Missing or case-mismatched path: ${path}`);
    current = resolve(current, part);
  }
  const rel = relative(realpathSync(root), realpathSync(current));
  check(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `Escaping path: ${path}`);
  return current;
}
// Conservative project intake gate, not a general-purpose SVG sanitizer.
export function inspectSvg(text) {
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  check(/<svg\b/.test(text), 'Missing SVG root');
  check(!/<\/?[\w-]+:[\w-]+\b/.test(text), 'Namespaced SVG elements require manual review');
  check(!/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|<\s*(?:script|foreignObject|iframe|image|animate\w*|set|a|audio|video)\b/i.test(text), 'Active or unsupported SVG content');
  check(!/\bon[\w-]+\s*=/i.test(text), 'SVG event handler');
  check(!/javascript:|data:|@import|\\|&#/i.test(text), 'Encoded or external SVG content');
  for (const match of text.matchAll(/(?:\b(?:xlink:)?href)\s*=\s*(["'])(.*?)\1/gi)) {
    check(/^#[A-Za-z_][\w.-]*$/.test(match[2]), 'External SVG reference');
  }
  for (const match of text.matchAll(/url\s*\((.*?)\)/gi)) {
    check(/^\s*["']?#[\w.-]+["']?\s*$/.test(match[1]), 'External SVG resource');
  }
  const ids = [...text.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
  check(new Set(ids).size === ids.length, 'Duplicate SVG ID');
  for (const match of text.matchAll(/(?:href\s*=\s*["']#|url\s*\(\s*["']?#)([\w.-]+)/g)) {
    check(ids.includes(match[1]), `Broken SVG reference: ${match[1]}`);
  }
  return ids;
}
function viewBox(text) {
  const match = text.match(/\bviewBox\s*=\s*["']([^"']+)["']/);
  check(match, 'Missing viewBox');
  const box = match[1].trim().split(/[\s,]+/).map(Number);
  check(box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0, 'Invalid viewBox');
  return box;
}
export function validateManifest(manifest, root) {
  check(manifest.schemaVersion === 1 && Array.isArray(manifest.assets), 'Invalid manifest');
  const register = readFileSync(resolve(root, 'assets/game/SOURCES.md'), 'utf8').replaceAll('\r\n', '\n');
  const ids = new Set();
  for (const asset of manifest.assets) {
    check(nonempty(asset.id) && !ids.has(asset.id), `Duplicate/invalid asset ID: ${asset.id}`);
    ids.add(asset.id);
    check(nonempty(asset.kind) && ['ready', 'placeholder', 'missing'].includes(asset.status), `Invalid asset metadata: ${asset.id}`);
    check(nonempty(asset.sourceId) && register.includes(`## ${asset.sourceId}\n`), `Missing source: ${asset.id}`);
    check(asset.views && typeof asset.views === 'object' && !Array.isArray(asset.views), `Invalid views: ${asset.id}`);
    if (asset.status === 'missing') {
      check(Object.keys(asset.views).length === 0 && nonempty(asset.note), `Missing asset needs reason and empty views: ${asset.id}`);
      continue;
    }
    check(Object.keys(asset.views).length > 0, `No views: ${asset.id}`);
    for (const [name, view] of Object.entries(asset.views)) {
      check(['top', 'tilted', 'shared'].includes(name) && view, `Invalid view: ${asset.id}`);
      const file = safeFile(root, view.path);
      check(Number.isFinite(view.width) && view.width > 0 && Number.isFinite(view.height) && view.height > 0, `Invalid dimensions: ${asset.id}`);
      check(point(view.anchor) && view.anchor[0] >= 0 && view.anchor[0] <= view.width && view.anchor[1] >= 0 && view.anchor[1] <= view.height, `Invalid anchor: ${asset.id}`);
      const bytes = readFileSync(file);
      if (view.path.endsWith('.svg')) {
        const svg = bytes.toString('utf8');
        inspectSvg(svg);
        let selected = svg;
        if (view.symbolId !== undefined) {
          check(/^[\w.-]+$/.test(view.symbolId), 'Invalid symbolId');
          selected = [...svg.matchAll(/<symbol\b[^>]*>/g)].map(m => m[0]).find(s => new RegExp(`\\bid=["']${view.symbolId}["']`).test(s));
          check(selected, `Missing SVG symbol: ${asset.id}`);
        }
        const box = viewBox(selected);
        check(box[2] === view.width && box[3] === view.height, `Actual SVG dimensions differ: ${asset.id}`);
      } else if (view.path.endsWith('.png')) {
        check(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid PNG');
        check(bytes.readUInt32BE(16) === view.width && bytes.readUInt32BE(20) === view.height, `Actual PNG dimensions differ: ${asset.id}`);
      } else throw new Error(`Unsupported asset format: ${view.path}`);
      if (view.frames !== undefined) {
        check(Array.isArray(view.frames) && view.frames.length > 0 && Number.isFinite(view.fps) && view.fps > 0, 'Invalid animation');
        for (const frame of view.frames) {
          check(Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite), 'Frame must be [x,y,width,height]');
          const [x, y, w, h] = frame;
          check(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= view.width && y + h <= view.height, 'Frame outside sheet');
        }
      }
    }
  }
  for (const id of requiredAssetIds) check(ids.has(id), `Unlisted required asset: ${id}`);
  return true;
}
function validateSources(sources) {
  check(Array.isArray(sources), 'Missing sources');
  const ids = new Set();
  for (const source of sources) {
    check(nonempty(source.id) && !ids.has(source.id), 'Duplicate/invalid source ID');
    ids.add(source.id);
    check(['publisher', 'url', 'location', 'reuse'].every(key => nonempty(source[key])), `Incomplete source: ${source.id}`);
    check(/^https:\/\//.test(source.url) && validDate(source.retrievedAt), `Invalid source URL/date: ${source.id}`);
    for (const field of ['publishedAt', 'referenceDate']) check(source[field] === null || validDate(source[field]), `Invalid source date: ${field}`);
  }
  return ids;
}
export function validateContext(context) {
  check(context.schemaVersion === 1 && Array.isArray(context.observations), 'Invalid city context');
  const sources = validateSources(context.sources);
  const ids = new Set();
  const units = { population: 'persons', bus_fleet_stock: 'vehicles', buses_active_daily: 'vehicles', bus_routes: 'routes', lrt_daily_ridership: 'trips/day' };
  for (const observation of context.observations) {
    const o = observation;
    check(nonempty(o.id) && !ids.has(o.id), 'Duplicate/invalid observation ID'); ids.add(o.id);
    check(o.regionId === 'city' || Object.hasOwn(districts, o.regionId), `Invalid scope: ${o.id}`);
    check(Object.hasOwn(units, o.metric) && o.unit === units[o.metric], `Invalid metric/unit: ${o.id}`);
    check(nonempty(o.definition) && nonempty(o.note), `Missing definition/note: ${o.id}`);
    check(['verified', 'unverified', 'unavailable'].includes(o.status), `Invalid observation status: ${o.id}`);
    check(o.value === null || (Number.isFinite(o.value) && o.value >= 0), `Invalid value: ${o.id}`);
    check(o.asOf === null || validDate(o.asOf), `Invalid date: ${o.id}`);
    check(o.sourceId === null || sources.has(o.sourceId), `Unknown source: ${o.id}`);
    if (o.status === 'verified') check(o.value !== null && o.asOf !== null && sources.has(o.sourceId), `Unsubstantiated verified observation: ${o.id}`);
    if (o.status === 'unavailable') check(o.value === null, `Unavailable must be null: ${o.id}`);
    if (o.asOf && o.asOf.length < 10) check(/precision/i.test(o.note), `Date precision missing: ${o.id}`);
  }
  return true;
}
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inPolygons = (p, polygons) => polygons.some(([outer, ...holes]) => inRing(p, outer) && holes.every(hole => !inRing(p, hole)));
function edgesCross(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
export function validateGeography(geo) {
  check(geo.schemaVersion === 1 && geo.id === 'astana' && ['fixture', 'unverified', 'verified'].includes(geo.status), 'Invalid geography');
  const sources = validateSources(geo.sources);
  check(geo.boundaryDate === null || validDate(geo.boundaryDate), 'Invalid boundary date');
  if (geo.status === 'verified') check(geo.boundaryDate !== null && sources.size > 0, 'Verified geography needs boundary date and sources');
  check(nonempty(geo.projection?.sourceCrs) && nonempty(geo.projection?.method) && geo.projection?.parameters, 'Missing projection');
  const box = geo.viewBox;
  check(Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0, 'Invalid world viewBox');
  const within = p => point(p) && p[0] >= box[0] && p[0] <= box[0] + box[2] && p[1] >= box[1] && p[1] <= box[1] + box[3];
  check(Array.isArray(geo.regions) && geo.regions.length === 6, 'Need six districts');
  const ids = new Set();
  for (const r of geo.regions) {
    check(Object.hasOwn(districts, r.regionId) && !ids.has(r.regionId), 'Invalid/duplicate district'); ids.add(r.regionId);
    check(r.simulationDistrict === districts[r.regionId] && nonempty(r.label), 'District mapping mismatch');
    check(Array.isArray(r.sourceIds) && r.sourceIds.length > 0 && r.sourceIds.every(id => sources.has(id)), 'Region source missing');
    check(Array.isArray(r.polygons) && r.polygons.length > 0, 'Region polygons missing');
    for (const polygon of r.polygons) {
      check(Array.isArray(polygon) && polygon.length > 0, 'Empty polygon');
      for (const ring of polygon) {
        check(Array.isArray(ring) && ring.length >= 4 && ring.every(within), 'Invalid ring coordinates');
        check(ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1], 'Ring not closed');
        const area = ring.slice(1).reduce((sum, p, i) => sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0);
        check(Math.abs(area) > 1e-9, 'Degenerate ring');
      }
      for (const hole of polygon.slice(1)) {
        const outer = polygon[0];
        check(hole.every(p => inRing(p, outer)), 'Hole outside outer ring');
        for (let i = 1; i < hole.length; i++) for (let j = 1; j < outer.length; j++) {
          check(!edgesCross(hole[i - 1], hole[i], outer[j - 1], outer[j]), 'Hole crosses outer ring');
        }
      }
    }
    check(within(r.labelAnchor) && inPolygons(r.labelAnchor, r.polygons), `Label outside district: ${r.regionId}`);
  }
  check(Array.isArray(geo.paths), 'Paths missing');
  const pathIds = new Set();
  for (const path of geo.paths) {
    check(nonempty(path.id) && !pathIds.has(path.id), 'Duplicate/invalid route'); pathIds.add(path.id);
    check(nonempty(path.kind) && Array.isArray(path.points) && path.points.length >= 2 && path.points.every(within), 'Invalid route geometry');
    check(typeof path.illustrative === 'boolean' && Array.isArray(path.sourceIds) && path.sourceIds.every(id => sources.has(id)), 'Route provenance missing');
    if (!path.illustrative) check(path.sourceIds.length > 0, 'Real route must have a source');
  }
  return true;
}

export function checkProject(root) {
  const load = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const manifest = load('assets/game/manifest.json');
  validateManifest(manifest, root);
  validateContext(load('data/city/context.json'));
  const warnings = manifest.assets.filter(a => a.status !== 'ready').map(a => `${a.id}: ${a.status}`);
  if (existsSync(resolve(root, 'data/geography/astana.json'))) {
    const geo = load('data/geography/astana.json'); validateGeography(geo);
    if (geo.status !== 'verified') warnings.push(`Geography ${geo.status}; independent boundary review required`);
  } else warnings.push('Geography missing');
  return { assets: manifest.assets.length, warnings };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkProject(resolve(fileURLToPath(new URL('..', import.meta.url))));
    console.log(`PASS: ${result.assets} asset entries; city/geography structure valid.`);
    console.log(result.warnings.join('\n'));
    if (process.argv.includes('--strict') && result.warnings.length) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
