// Reproducible conversion of the retained Esri JSON; no network and no simplification.
import { readFileSync, writeFileSync } from 'node:fs';
import { inRing, inPolygons, validateGeography } from '../../tools/check-assets.mjs';

const raw = JSON.parse(readFileSync(new URL('sources/esaulet-districts.esri.json', import.meta.url)));
if (raw.exceededTransferLimit || raw.features?.length !== 6) throw new Error('Incomplete district source');
const mapping = {
  'Есиль': ['esil', 'Есиль', 'Есиль'], 'Алматы': ['almaty', 'Алматы', 'Алматы'],
  'Сарыарка': ['saryarka', 'Сарыарка', 'Сарыарка'], 'Байконур': ['baikonur', 'Байконур', 'Байконур'],
  'Нура': ['nura', 'Нура', 'Нура'], 'Сарайшык': ['saraishyk', 'Сарайшық', null],
};
const all = raw.features.flatMap(f => f.geometry.rings.flat());
const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
const scale = 920 / Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
const project = ([x, y]) => [+(40 + (x - bounds[0]) * scale).toFixed(6), +(40 + (bounds[3] - y) * scale).toFixed(6)];
const area = ring => Math.abs(ring.slice(1).reduce((sum, p, i) => sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0) / 2);
// Containment nesting preserves multipart islands and holes independent of ring orientation.
function nest(rings) {
  const nodes = rings.map(ring => ({ ring, area: area(ring), parent: null, depth: 0 })).sort((a, b) => b.area - a.area);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.parent = nodes.slice(0, i).filter(n => inRing(node.ring[0], n.ring)).sort((a, b) => a.area - b.area)[0] ?? null;
    node.depth = node.parent ? node.parent.depth + 1 : 0;
  }
  return nodes.filter(n => n.depth % 2 === 0).map(n => [n.ring, ...nodes.filter(h => h.parent === n && h.depth % 2 === 1).map(h => h.ring)]);
}
function label(polygons) {
  const points = polygons.flat(2);
  const x0 = Math.min(...points.map(p => p[0])), x1 = Math.max(...points.map(p => p[0]));
  const y0 = Math.min(...points.map(p => p[1])), y1 = Math.max(...points.map(p => p[1]));
  let best = null, clearance = -1;
  const distance = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
  };
  for (let x = 1; x < 50; x++) for (let y = 1; y < 50; y++) {
    const p = [x0 + (x1 - x0) * x / 50, y0 + (y1 - y0) * y / 50];
    if (!inPolygons(p, polygons)) continue;
    let nearest = Infinity;
    for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) nearest = Math.min(nearest, distance(p, ring[i - 1], ring[i]));
    if (nearest > clearance) { best = p; clearance = nearest; }
  }
  if (!best) throw new Error('No interior label found');
  return best.map(n => +n.toFixed(6));
}
const source = {
  id: 'esaulet-districts', publisher: 'GIS esaulet.kz, Hosted/raiony, layer 0',
  url: 'https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0',
  referenceDate: null, publishedAt: null, retrievedAt: '2026-09-23',
  location: 'Six features, name_object + name_object_kaz; retained full query and layer metadata in sources/',
  reuse: 'Copyright field empty; reuse permission not established. Review before shipping.',
};
const geo = {
  schemaVersion: 1, id: 'astana', status: 'unverified', viewBox: [0, 0, 1000, 1000],
  projection: { sourceCrs: raw.spatialReference.wkt, method: 'Uniform affine normalization of source planar metres; source grid +Y is world -Y; true-north orientation unverified; no camera tilt', parameters: { sourceBounds: bounds, scale, padding: 40, yAxis: 'down' } },
  boundaryDate: null, sources: [source],
  note: 'Boundary vintage and reuse terms unknown. Six sourced polygons are a review candidate, not certified current administrative boundaries. No WGS84 conversion or independent district scaling.',
  regions: raw.features.map(f => {
    const identity = mapping[f.attributes.name_object];
    if (!identity) throw new Error('Unknown source district');
    const [regionId, name, simulationDistrict] = identity;
    const polygons = nest(f.geometry.rings.map(ring => ring.map(project)));
    return { regionId, label: name, simulationDistrict, polygons, labelAnchor: label(polygons), sourceIds: [source.id], sourceName: f.attributes.name_object, sourceObjectId: f.attributes.objectid };
  }), paths: [],
};
validateGeography(geo);
writeFileSync(new URL('astana.json', import.meta.url), JSON.stringify(geo, null, 2) + '\n');
const colors = ['#b6c9a7', '#edc49e', '#d5c1dd', '#adcbd3', '#d9d6a3', '#e7b2a5'];
const drawing = geo.regions.map((r, i) => {
  const path = r.polygons.map(poly => poly.map(ring => 'M' + ring.map(p => p.join(',')).join('L') + 'Z').join(' ')).join(' ');
  return `<path d="${path}" fill="${colors[i]}" fill-rule="evenodd" stroke="#35454b" stroke-width="1"/><circle cx="${r.labelAnchor[0]}" cy="${r.labelAnchor[1]}" r="3" fill="#182c34"/><text x="${r.labelAnchor[0] + 6}" y="${r.labelAnchor[1] - 6}" font-size="16">${r.label}</text>`;
}).join('\n');
writeFileSync(new URL('review.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1040" width="1000" height="1040"><rect width="1000" height="1040" fill="#faf8f2"/><g font-family="Arial" fill="#182c34"><text x="24" y="26" font-size="18">UNVERIFIED — six source districts / boundary date unknown</text>${drawing}<text x="24" y="1012" font-size="15">Source grid +Y ↑ · True north unverified · No real routes supplied · Review before release</text></g></svg>\n`);
console.log(`Exported ${geo.regions.length} districts, ${all.length} source points; no points simplified.`);
