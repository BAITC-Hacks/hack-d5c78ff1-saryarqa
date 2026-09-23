/**
 * Material and massing treatment for source building footprints.
 * Footprint vertices, holes and multipolygon parts are retained exactly.
 * Heights, roof materials, highlights and shadows are illustrative styling.
 */
const NS = 'http://www.w3.org/2000/svg';
const MATERIALS = Object.freeze([
  { roof: '#d9dfe0', edge: '#7d9095', light: '#c3c8bd', dark: '#8b9998' },
  { roof: '#e4d8be', edge: '#a6967e', light: '#d3c6ac', dark: '#a99b85' },
  { roof: '#f0ece1', edge: '#a5a897', light: '#dedaca', dark: '#a9b2a7' },
  { roof: '#b5c8d0', edge: '#718e98', light: '#abbec0', dark: '#789397' },
  { roof: '#c5cec1', edge: '#86978a', light: '#bdc8b5', dark: '#8b9e91' },
  { roof: '#d8c9b4', edge: '#9e8d78', light: '#cbbca4', dark: '#9d9485' },
]);

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
      const height = tilted ? Math.min(2.8, Math.max(.35, Math.sqrt(bounds.width * bounds.height) * .6)) : 0;
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
      'vector-effect': 'non-scaling-stroke', 'fill-rule': 'nonzero', opacity: .075 }));
    root.appendChild(element('path', { d: shadows, class: 'atlas-building-shadow-contact',
      fill: '#354a44', 'fill-rule': 'nonzero', opacity: tilted ? .14 : .09 }));
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
