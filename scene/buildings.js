/**
 * Material and massing treatment for source building footprints.
 * Footprint vertices, holes and multipolygon parts are retained exactly.
 * Heights, roof materials, highlights and shadows are illustrative styling.
 */
const NS = 'http://www.w3.org/2000/svg';
const MATERIALS = Object.freeze([
  { roof: '#bed6d6', edge: '#6c9092', light: '#eff0d9', dark: '#8eafa7' },
  { roof: '#dfb77a', edge: '#a48a62', light: '#f7e9bf', dark: '#b5a074' },
  { roof: '#f7f2da', edge: '#92a083', light: '#e8e6ca', dark: '#93aa90' },
  { roof: '#8fbfc7', edge: '#5a9099', light: '#d1e3d9', dark: '#6f9d9a' },
  { roof: '#c9d8b1', edge: '#7c9c7f', light: '#e5e7c7', dark: '#8ba58c' },
  { roof: '#d5a68b', edge: '#a88771', light: '#f1dcc1', dark: '#b3a18a' },
]);
const footprintCache = new WeakMap();

const element = (tag, attributes) => {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
};
const finitePoint = point => Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1]);
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
const screenPoint = (point, [a, b, c, d]) => [a * point[0] + c * point[1], b * point[0] + d * point[1]];

function hash(value) {
  let result = 2166136261;
  for (const letter of String(value)) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
  return result >>> 0;
}

function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const p = ring[index], q = ring[(index + 1) % ring.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return area / 2;
}

function ringPath(ring, offset, reverse = false) {
  const points = reverse ? [...ring].reverse() : ring;
  return `M${points.map(point => `${point[0] + offset[0]},${point[1] + offset[1]}`).join('L')}Z`;
}

function polygonPath(polygon, offset, consistentWinding = false) {
  return polygon.map((ring, index) => ringPath(ring, offset,
    consistentWinding && (signedArea(ring) > 0) !== (index === 0))).join('');
}

function getBounds(polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of polygon[0]) {
    minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function cachedFootprint(building) {
  if (!building || typeof building !== 'object') return null;
  const cached = footprintCache.get(building);
  if (cached?.geometry === building.polygons) return cached;
  const parts = [];
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of Array.isArray(building.polygons) ? building.polygons : []) {
    if (!Array.isArray(polygon) || !polygon.length || !polygon.every(ring => Array.isArray(ring)
      && ring.length >= 3 && ring.every(finitePoint))) continue;
    const box = getBounds(polygon);
    const partBounds = [box.minX, box.minY, box.minX + box.width, box.minY + box.height];
    const area = Math.max(0, Math.abs(signedArea(polygon[0]))
      - polygon.slice(1).reduce((total, ring) => total + Math.abs(signedArea(ring)), 0));
    if (!(area > 0) || !Number.isFinite(area)) continue;
    parts.push({ bounds: partBounds, polygon, area });
    bounds[0] = Math.min(bounds[0], partBounds[0]); bounds[1] = Math.min(bounds[1], partBounds[1]);
    bounds[2] = Math.max(bounds[2], partBounds[2]); bounds[3] = Math.max(bounds[3], partBounds[3]);
  }
  const result = { geometry: building.polygons, bounds, parts };
  footprintCache.set(building, result);
  return result;
}

const intersects = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const encloses = (outer, inner) => outer[0] <= inner[0] && outer[1] <= inner[1]
  && outer[2] >= inner[2] && outer[3] >= inner[3];

// Sutherland–Hodgman clipping is needed only at viewport edges. Whole visible
// polygons use cached areas; most offscreen buildings need only four comparisons.
function clippedRingArea(ring, bounds) {
  let points = samePoint(ring[0], ring.at(-1)) ? ring.slice(0, -1) : ring.slice();
  for (const [axis, edge, direction] of [[0, bounds[0], 1], [0, bounds[2], -1], [1, bounds[1], 1], [1, bounds[3], -1]]) {
    if (points.length < 3) return 0;
    const output = [];
    let previous = points.at(-1);
    let previousInside = (previous[axis] - edge) * direction >= 0;
    for (const current of points) {
      const currentInside = (current[axis] - edge) * direction >= 0;
      if (currentInside !== previousInside) {
        const fraction = (edge - previous[axis]) / (current[axis] - previous[axis]);
        const crossing = [previous[0] + fraction * (current[0] - previous[0]),
          previous[1] + fraction * (current[1] - previous[1])];
        crossing[axis] = edge;
        output.push(crossing);
      }
      if (currentInside) output.push(current);
      previous = current; previousInside = currentInside;
    }
    points = output;
  }
  return points.length >= 3 ? Math.abs(signedArea(points)) : 0;
}

/**
 * Pick loaded source features for the current viewport, not their source order.
 * Bounds are [left, top, right, bottom] in the same world space as polygons.
 * A footprint must cover at least 5 screen pixels² in the viewport. Sorting uses
 * its visible area (minus courtyards), then stable identity; small nearby blocks
 * naturally appear as zoom increases. Returned entries are original objects.
 * Treat source geometry as immutable. Replacing building.polygons invalidates
 * the WeakMap entry; evicted tile features are free to be garbage-collected.
 */
export function selectVisibleBuildings(buildings, { viewBounds, pixelsPerWorldUnit = 1, maxCount = 1800 } = {}) {
  if (!Array.isArray(buildings) || !Array.isArray(viewBounds) || viewBounds.length !== 4
    || !viewBounds.every(Number.isFinite) || viewBounds[0] >= viewBounds[2] || viewBounds[1] >= viewBounds[3]
    || !Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0
    || !Number.isFinite(maxCount) || maxCount < 1) return [];
  const pixelAreaScale = pixelsPerWorldUnit * pixelsPerWorldUnit;
  if (!Number.isFinite(pixelAreaScale)) return [];
  const minimumWorldArea = 5 / pixelAreaScale;
  const candidates = [];
  for (const building of buildings) {
    const cached = cachedFootprint(building);
    if (!cached?.parts.length || !intersects(cached.bounds, viewBounds)) continue;
    let visibleArea = 0;
    for (const part of cached.parts) {
      if (!intersects(part.bounds, viewBounds)) continue;
      if (encloses(viewBounds, part.bounds)) { visibleArea += part.area; continue; }
      // A viewport wholly inside a courtyard contributes zero, not its bbox area.
      visibleArea += Math.max(0, clippedRingArea(part.polygon[0], viewBounds)
        - part.polygon.slice(1).reduce((sum, ring) => sum + clippedRingArea(ring, viewBounds), 0));
    }
    if (visibleArea < minimumWorldArea) continue;
    const key = String(building.id ?? cached.bounds.join(','));
    candidates.push({ building, visibleArea, key });
  }
  candidates.sort((left, right) => right.visibleArea - left.visibleArea
    || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return candidates.slice(0, Math.floor(maxCount)).map(candidate => candidate.building);
}

/**
 * Returns a world-coordinate SVG <g> for the atlas ground layer. The caller
 * applies its camera matrix to the ancestor, once. No global camera is read.
 * At most four paths per polygon, plus two shared shadow paths for the layer.
 * `projection` accepts the same 'top' / 'tilted' modes as the scene camera.
 */
export function buildBuildings({ buildings = [], projection = 'top' } = {}) {
  const tilted = projection === 'tilted';
  const matrix = tilted ? [1, .24, -.35, .65] : [1, 0, 0, 1];
  const [a, b, c, d] = matrix;
  const determinant = a * d - b * c;
  const worldVector = ([x, y]) => [(d * x - c * y) / determinant, (-b * x + a * y) / determinant];
  const root = element('g', {
    class: 'atlas-building-materials', 'data-footprints': 'source-geometry',
    'data-heights': 'illustrative', 'data-materials': 'illustrative',
    'data-projection': tilted ? 'tilted' : 'top', 'pointer-events': 'none',
    'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  });
  const pieces = [];
  for (const [buildingIndex, building] of buildings.entries()) {
    for (const [partIndex, polygon] of (building.polygons || []).entries()) {
      if (!Array.isArray(polygon) || !polygon.length || !polygon.every(ring => Array.isArray(ring)
        && ring.length >= 3 && ring.every(finitePoint))) continue;
      const bounds = getBounds(polygon);
      if (!bounds.width || !bounds.height || !signedArea(polygon[0])) continue;
      // Readable game relief is illustrative, as are the stable material colors.
      // Exact source footprints and courtyard holes remain unchanged.
      const height = tilted ? Math.min(4.4, Math.max(.7, Math.sqrt(bounds.width * bounds.height) * .95)) : 0;
      const id = building.id ?? `building-${buildingIndex}`;
      const material = MATERIALS[hash(id) % MATERIALS.length];
      const offset = worldVector([0, -height]);
      const shadowOffset = worldVector(tilted ? [height * .5, height * .35] : [.12, .16]);
      let depth = -Infinity;
      for (const point of polygon[0]) depth = Math.max(depth, screenPoint(point, matrix)[1]);
      pieces.push({ polygon, id, partIndex, height, offset, shadowOffset, depth, material });
    }
  }
  pieces.sort((left, right) => left.depth - right.depth);
  root.setAttribute('data-polygon-count', pieces.length);

  // One ambient veil and one contact shadow for the entire layer. Consistent
  // winding keeps overlapping shadows solid while preserving courtyard holes.
  const shadows = pieces.map(piece => polygonPath(piece.polygon, piece.shadowOffset, true)).join('');
  if (shadows) {
    root.appendChild(element('path', { d: shadows, class: 'atlas-building-shadow-soft',
      fill: '#2d4943', stroke: '#2d4943', 'stroke-width': 2.3,
      'vector-effect': 'non-scaling-stroke', 'fill-rule': 'nonzero', opacity: .1 }));
    root.appendChild(element('path', { d: shadows, class: 'atlas-building-shadow-contact',
      fill: '#354a44', 'fill-rule': 'nonzero', opacity: tilted ? .2 : .09 }));
  }

  for (const piece of pieces) {
    const { polygon, offset, height, material } = piece;
    let litFaces = '', darkFaces = '', highlights = '';
    for (const [ringIndex, inputRing] of polygon.entries()) {
      const ring = samePoint(inputRing[0], inputRing.at(-1)) ? inputRing.slice(0, -1) : inputRing;
      // Normalize direction for face visibility only, never for the roof shape.
      const positive = signedArea(ring) > 0;
      const orientation = (positive ? 1 : -1) * (ringIndex ? -1 : 1);
      for (let index = 0; index < ring.length; index += 1) {
        const p = ring[index], q = ring[(index + 1) % ring.length];
        const sp = screenPoint(p, matrix), sq = screenPoint(q, matrix);
        const dx = (sq[0] - sp[0]) * orientation, dy = (sq[1] - sp[1]) * orientation;
        const normal = [dy, -dx];
        // Light comes from the upper left. The existing edges become a restrained
        // roof bevel: no inset polygon, roof extension, or fabricated footprint.
        if (-normal[0] - normal[1] > 0) highlights += `M${p[0] + offset[0]},${p[1] + offset[1]}L${q[0] + offset[0]},${q[1] + offset[1]}`;
        if (!height || normal[1] <= 0) continue;
        const face = ringPath([p, q, [q[0] + offset[0], q[1] + offset[1]], [p[0] + offset[0], p[1] + offset[1]]], [0, 0]);
        if (normal[0] < -.2 * Math.abs(normal[1])) litFaces += face;
        else darkFaces += face;
      }
    }
    const faceAttributes = { 'stroke-width': .3, 'vector-effect': 'non-scaling-stroke',
      stroke: material.edge, 'data-building-id': piece.id };
    if (darkFaces) root.appendChild(element('path', { d: darkFaces, fill: material.dark,
      class: 'atlas-building-face-dark', ...faceAttributes }));
    if (litFaces) root.appendChild(element('path', { d: litFaces, fill: material.light,
      class: 'atlas-building-face-light', ...faceAttributes }));
    root.appendChild(element('path', {
      d: polygonPath(polygon, offset), class: 'atlas-building-roof', fill: material.roof,
      stroke: material.edge, 'stroke-width': .6, 'vector-effect': 'non-scaling-stroke',
      'fill-rule': 'evenodd', 'data-building-id': piece.id, 'data-polygon-index': piece.partIndex,
      'data-illustrative-height': height,
    }));
    if (highlights) root.appendChild(element('path', {
      d: highlights, class: 'atlas-building-roof-highlight', fill: 'none',
      stroke: '#ffffff', opacity: .72, 'stroke-width': .65, 'vector-effect': 'non-scaling-stroke',
    }));
  }
  return root;
}
