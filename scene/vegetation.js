/** Decorative, source-constrained greenery. These samples are not a tree inventory. */
const NS = 'http://www.w3.org/2000/svg';
const SPACING = 0.38; // In this atlas, about 13 m. Coordinates never depend on the camera.
const MAX_RADIUS = 0.11;
const MAX_FOOTPRINT = 0.94; // Minimum legible crown at the lowest tree LOD.
const INDEX_SIZE = 4;
const SHAPE_CACHE = new WeakMap();
const LANDSCAPE_CACHE = new WeakMap();
const BLOCKER_CACHE = new WeakMap();
const ROAD_CACHE = new WeakMap();
const EMPTY = Object.freeze([]);
const GREEN_KINDS = new Set(['park', 'forest', 'wood']);
const finitePoint = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const inBounds = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
const overlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const expanded = (b, amount) => [b[0] - amount, b[1] - amount, b[2] + amount, b[3] + amount];
const hash = value => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  result ^= result >>> 16; result = Math.imul(result, 0x7feb352d); result ^= result >>> 15;
  return (result >>> 0) / 4294967296;
};

function segmentDistanceSquared(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
}

function insideRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (segmentDistanceSquared(p, a, b) < 1e-18) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const insideShape = (p, shape) => shape.polygons.some(polygon => insideRing(p, polygon[0]) && !polygon.slice(1).some(ring => insideRing(p, ring)));
const nearBoundary = (p, shape, clearance) => shape.segments.some(([a, b]) => segmentDistanceSquared(p, a, b) <= clearance * clearance);

function shapeOf(feature) {
  if (!feature || typeof feature !== 'object') return null;
  if (SHAPE_CACHE.has(feature)) return SHAPE_CACHE.get(feature);
  const polygons = feature.polygons;
  if (!Array.isArray(polygons) || !polygons.length || polygons.some(polygon => !Array.isArray(polygon) || !polygon.length
    || polygon.some(ring => !Array.isArray(ring) || ring.length < 4 || !ring.every(finitePoint)))) {
    SHAPE_CACHE.set(feature, null); return null;
  }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity], segments = [];
  let area = 0;
  for (const polygon of polygons) for (const [ringIndex, ring] of polygon.entries()) {
    let ringArea = 0;
    for (let index = 0; index < ring.length; index++) {
      const p = ring[index], next = ring[(index + 1) % ring.length];
      bounds[0] = Math.min(bounds[0], p[0]); bounds[1] = Math.min(bounds[1], p[1]);
      bounds[2] = Math.max(bounds[2], p[0]); bounds[3] = Math.max(bounds[3], p[1]);
      ringArea += p[0] * next[1] - next[0] * p[1];
      if (p[0] !== next[0] || p[1] !== next[1]) segments.push([p, next]);
    }
    area += Math.abs(ringArea) / 2 * (ringIndex === 0 ? 1 : -1);
  }
  const shape = { id: String(feature.id ?? ''), polygons, bounds, segments, area };
  SHAPE_CACHE.set(feature, shape); return shape;
}

function spatialIndex(records, padding) {
  const cells = new Map(), large = [];
  for (const record of records) {
    const bounds = expanded(record.bounds, padding);
    const minX = Math.floor(bounds[0] / INDEX_SIZE), maxX = Math.floor(bounds[2] / INDEX_SIZE);
    const minY = Math.floor(bounds[1] / INDEX_SIZE), maxY = Math.floor(bounds[3] / INDEX_SIZE);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 256) { large.push(record); continue; }
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
      const key = `${x}:${y}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(record);
    }
  }
  return p => [...(cells.get(`${Math.floor(p[0] / INDEX_SIZE)}:${Math.floor(p[1] / INDEX_SIZE)}`) || EMPTY), ...large];
}

function landscapeOf(input) {
  const features = Array.isArray(input) ? input : EMPTY;
  if (LANDSCAPE_CACHE.has(features)) return LANDSCAPE_CACHE.get(features);
  const parks = [], water = [];
  for (const feature of features) {
    if (!GREEN_KINDS.has(feature?.kind) && !/^(water|river|hydro)$/.test(feature?.kind)) continue;
    const shape = shapeOf(feature); if (!shape) continue;
    if (GREEN_KINDS.has(feature.kind) && shape.id) parks.push(shape);
    else water.push(shape);
  }
  parks.sort((a, b) => a.id.localeCompare(b.id));
  const result = { parks, water: spatialIndex(water, MAX_FOOTPRINT) };
  LANDSCAPE_CACHE.set(features, result); return result;
}

function buildingsOf(input) {
  const features = Array.isArray(input) ? input : EMPTY;
  if (BLOCKER_CACHE.has(features)) return BLOCKER_CACHE.get(features);
  const index = spatialIndex(features.map(shapeOf).filter(Boolean), MAX_FOOTPRINT);
  BLOCKER_CACHE.set(features, index); return index;
}

function roadsOf(input) {
  const features = Array.isArray(input) ? input : EMPTY;
  if (ROAD_CACHE.has(features)) return ROAD_CACHE.get(features);
  const segments = [];
  for (const road of features) {
    const points = road?.points;
    if (!Array.isArray(points)) continue;
    const clearance = /motorway|trunk|primary/.test(road.kind) || road.importance >= 4 ? 0.26 : 0.14;
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index]; if (!finitePoint(a) || !finitePoint(b)) continue;
      segments.push({ a, b, clearance, bounds: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] });
    }
  }
  const index = spatialIndex(segments, 0.26 + MAX_FOOTPRINT);
  ROAD_CACHE.set(features, index); return index;
}

/**
 * Pure deterministic samples in source green-space polygons. Positions, IDs,
 * species and physical size are fixed by source ID and the global world grid.
 * Display crowns have a 1.55px readability floor, explicitly illustrative. Their
 * complete larger footprint must still clear every source boundary/obstacle.
 * LOD omits nested grid cells; it never moves a tree. New feature/array objects
 * invalidate the weak caches when source geometry or building tiles change.
 * viewBounds is [minX,minY,maxX,maxY]. maxCount defaults to 450; mobile uses 200.
 */
export function selectVegetation({ landscape = EMPTY, buildings = EMPTY, roads = EMPTY, viewBounds,
  pixelsPerWorldUnit = 1, maxCount = 450 } = {}) {
  if (!Array.isArray(viewBounds) || viewBounds.length !== 4 || !viewBounds.every(Number.isFinite)
    || viewBounds[0] >= viewBounds[2] || viewBounds[1] >= viewBounds[3]
    || !Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0
    || MAX_RADIUS * 2 * pixelsPerWorldUnit < 0.7) return [];
  const limit = Math.min(450, Math.max(0, Math.floor(Number.isFinite(maxCount) ? maxCount : 450)));
  if (!limit) return [];
  const { parks, water } = landscapeOf(landscape);
  const blockedBuildings = buildingsOf(buildings), blockedRoads = roadsOf(roads);
  const minimumRadius = 1.55 / pixelsPerWorldUnit;
  const stride = 2 ** Math.max(0, Math.ceil(Math.log2(2.8 * Math.max(MAX_RADIUS, minimumRadius) / SPACING)));
  const candidates = [], occupied = new Set();
  for (const park of parks) {
    if (!overlap(park.bounds, viewBounds) || park.area * pixelsPerWorldUnit ** 2 < 6) continue;
    const minX = Math.floor(Math.max(park.bounds[0], viewBounds[0]) / SPACING / stride) * stride;
    const maxX = Math.ceil(Math.min(park.bounds[2], viewBounds[2]) / SPACING);
    const minY = Math.floor(Math.max(park.bounds[1], viewBounds[1]) / SPACING / stride) * stride;
    const maxY = Math.ceil(Math.min(park.bounds[3], viewBounds[3]) / SPACING);
    for (let x = minX; x <= maxX; x += stride) for (let y = minY; y <= maxY; y += stride) {
      const cell = `${x}:${y}`; if (occupied.has(cell)) continue;
      const id = `${park.id}:tree:${cell}`, priority = hash(id);
      if (priority > 0.67) continue; // Breathing room between grouped crowns.
      const position = [(x + 0.5 + (hash(`${id}:x`) - 0.5) * 0.48) * SPACING,
        (y + 0.5 + (hash(`${id}:y`) - 0.5) * 0.48) * SPACING];
      const physicalRadius = 0.072 + hash(`${id}:size`) * 0.038;
      const radius = Math.max(physicalRadius, minimumRadius);
      const footprint = radius * 1.9; // Includes tilted crown, trunk and soft shadow.
      if (!inBounds(position, viewBounds) || !inBounds(position, park.bounds)
        || radius * 2 * pixelsPerWorldUnit < 0.7
        || !insideShape(position, park) || nearBoundary(position, park, footprint)) continue;
      const blocked = shape => inBounds(position, expanded(shape.bounds, footprint))
        && (insideShape(position, shape) || nearBoundary(position, shape, footprint));
      if (water(position).some(blocked) || blockedBuildings(position).some(blocked)
        || blockedRoads(position).some(road => segmentDistanceSquared(position, road.a, road.b) <= (road.clearance + footprint) ** 2)) continue;
      occupied.add(cell);
      candidates.push({ id, sourceId: park.id, position, radius, physicalRadius,
        kind: hash(`${id}:kind`) < 0.22 ? 'pine' : 'deciduous', variant: Math.floor(hash(`${id}:color`) * 4), priority });
    }
  }
  // Stable priority gives a spread across the visible parks when the renderer cap
  // is reached, without claiming that omitted trees are absent in the real city.
  return candidates.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, limit)
    .sort((a, b) => a.position[1] - b.position[1] || a.position[0] - b.position[0])
    .map(({ priority, ...tree }) => tree);
}

const coordinate = value => Number(value.toFixed(4));
const pair = (x, y) => `${coordinate(x)} ${coordinate(y)}`;
const ellipse = (x, y, rx, ry) => `M${pair(x - rx, y)}a${pair(rx, ry)} 0 1 0 ${pair(rx * 2, 0)}a${pair(rx, ry)} 0 1 0 ${pair(-rx * 2, 0)}Z`;
const crown = (x, y, r) => `M${pair(x - r, y)}C${pair(x - r * 1.04, y - r * .7)} ${pair(x - r * .55, y - r * 1.13)} ${pair(x - r * .15, y - r * .93)}C${pair(x + r * .5, y - r * 1.2)} ${pair(x + r * 1.12, y - r * .58)} ${pair(x + r * .93, y - r * .1)}C${pair(x + r * 1.14, y + r * .6)} ${pair(x + r * .3, y + r * 1.13)} ${pair(x - r * .12, y + r * .86)}C${pair(x - r * .75, y + r)} ${pair(x - r * 1.12, y + r * .43)} ${pair(x - r, y)}Z`;

/** SVG group for the atlas ground transform. No timers, styles or global IDs. */
export function createVegetation(options = {}) {
  const trees = selectVegetation(options), tilted = options.projection === 'tilted';
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('class', 'atlas-vegetation'); group.setAttribute('pointer-events', 'none');
  group.setAttribute('aria-hidden', 'true'); group.setAttribute('data-count', String(trees.length));
  group.setAttribute('data-illustrative', 'true');
  group.setAttribute('data-canopy-scale', 'legibility-sample-not-inventory');
  const materials = new Map();
  const add = (material, path) => { if (!materials.has(material)) materials.set(material, []); materials.get(material).push(path); };
  for (const tree of trees) {
    const [x, y] = tree.position, r = tree.radius;
    add('shadow-soft', ellipse(x + r * .24, y + r * .27, r * 1.24, r * .72));
    add('shadow', ellipse(x + r * .18, y + r * .25, r * .97, r * .51));
    if (tilted) add('trunk', `M${pair(x - r * .12, y + r * .17)}L${pair(x - r * .09, y - r * .74)}L${pair(x + r * .09, y - r * .74)}L${pair(x + r * .13, y + r * .17)}Z`);
    const cy = y - (tilted ? r * .55 : 0);
    if (tree.kind === 'pine' && tilted) {
      add(`pine-${tree.variant}`, `M${pair(x, cy - r * 1.1)}L${pair(x + r * .49, cy - r * .27)}L${pair(x + r * .3, cy - r * .27)}L${pair(x + r * .77, cy + r * .52)}Q${pair(x, cy + r * .88)} ${pair(x - r * .77, cy + r * .52)}L${pair(x - r * .3, cy - r * .27)}L${pair(x - r * .49, cy - r * .27)}Z`);
      add('pine-light', `M${pair(x, cy - r * 1.05)}L${pair(x, cy + r * .63)}L${pair(x - r * .64, cy + r * .5)}L${pair(x - r * .25, cy - r * .25)}L${pair(x - r * .42, cy - r * .25)}Z`);
    } else {
      add(`${tree.kind}-${tree.variant}`, crown(x, cy, r * (tree.kind === 'pine' ? .8 : 1)));
      add('leaf-light', ellipse(x - r * .29, cy - r * .34, r * .46, r * .38));
      add('leaf-glint', ellipse(x - r * .33, cy - r * .53, r * .21, r * .12));
    }
  }
  const colors = { 'shadow-soft': '#294c3910', shadow: '#294c391c', trunk: '#7a6751',
    'deciduous-0': '#699651', 'deciduous-1': '#79a461', 'deciduous-2': '#5c8d50', 'deciduous-3': '#8eac61',
    'pine-0': '#38694d', 'pine-1': '#477b54', 'pine-2': '#51805a', 'pine-3': '#5a8a5f',
    'pine-light': '#98b77566', 'leaf-light': '#bad38d55', 'leaf-glint': '#dee6b633' };
  for (const material of ['shadow-soft', 'shadow', 'trunk', ...Array.from({ length: 4 }, (_, i) => `deciduous-${i}`),
    ...Array.from({ length: 4 }, (_, i) => `pine-${i}`), 'pine-light', 'leaf-light', 'leaf-glint']) {
    if (!materials.has(material)) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', materials.get(material).join('')); path.setAttribute('fill', colors[material]);
    path.setAttribute('data-material', material); group.appendChild(path);
  }
  return group;
}
