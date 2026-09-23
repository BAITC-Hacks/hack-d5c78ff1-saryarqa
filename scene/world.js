import { pointInRegion, regionBounds, segmentsCross } from './camera.js';

export const REGION_IDS = ['esil', 'almaty', 'saryarka', 'baikonur', 'nura', 'saraishyk'];
export const REGION_COLORS = ['#a5c5b5', '#ddbf99', '#c6ce9c', '#b3c7ce', '#87b6a6', '#d4d0c6'];

// A deliberately illustrative play area, never a surveyed pedestrian network.
export function createWorld(geography) {
  if (geography?.schemaVersion !== 1 || !Array.isArray(geography.viewBox) ||
      geography.viewBox.length !== 4 || !geography.viewBox.every(Number.isFinite) ||
      geography.viewBox[2] <= 0 || geography.viewBox[3] <= 0 ||
      !Array.isArray(geography.regions) ||
      REGION_IDS.some(id => geography.regions.filter(r => r.regionId === id).length !== 1)) {
    throw new TypeError('Scene requires v1 geography with all six districts and a valid viewBox.');
  }
  const regions = geography.regions;
  for (const region of regions) {
    if (!regionBounds(region) || !pointInRegion(region.labelAnchor, region)) {
      throw new TypeError(`Invalid polygons or label anchor: ${region.regionId}`);
    }
  }
  const nura = regions.find(region => region.regionId === 'nura');
  const bounds = regionBounds(nura);
  const start = [...nura.labelAnchor];
  let half = Math.min(bounds.width, bounds.height) * 0.32;
  // Check a fine grid as well as every movement point; narrow holes stay excluded.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let fits = true;
    for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
      if (!pointInRegion([start[0] + x * half / 4, start[1] + y * half / 4], nura)) fits = false;
    }
    if (fits) break;
    half *= 0.78;
  }
  const size = half * 2;
  const playBounds = [start[0] - half, start[1] - half, size, size];
  const pieces = [];
  const buildings = [
    [-.64, -.58, 'building.apartment'], [.62, -.62, 'building.civic'],
    [-.65, .6, 'building.home'], [.65, .58, 'building.school'],
  ];
  const obstacles = [];
  for (const [x, y, assetId] of buildings) {
    const position = [start[0] + x * half, start[1] + y * half];
    const footprint = [position[0] - size * .09, position[1] - size * .09, size * .18, size * .18];
    if (!pointInRegion(position, nura)) continue;
    obstacles.push(footprint);
    pieces.push({ id: `detail-${assetId}`, assetId, position, size: size * .29, detail: true });
  }
  for (const [index, [x, y]] of [[-.9, -.9], [-.42, -.86], [.42, -.88], [.87, -.87], [-.88, -.3], [.88, -.28], [-.89, .26], [.88, .25], [-.87, .9], [-.37, .86], [.38, .88], [.89, .9]].entries()) {
    const position = [start[0] + x * half, start[1] + y * half];
    if (!pointInRegion(position, nura)) continue;
    obstacles.push([position[0] - size * .025, position[1] - size * .025, size * .05, size * .05]);
    pieces.push({ id: `detail-tree-${index}`, assetId: 'terrain.tree', position, size: size * .14, detail: true });
  }
  for (const region of regions) {
    const b = regionBounds(region);
    for (let index = 0; index < 9; index++) {
      const point = [b.x + b.width * (.17 + ((index * 37) % 71) / 100),
        b.y + b.height * (.15 + ((index * 23) % 67) / 100)];
      if (pointInRegion(point, region) && Math.hypot(point[0] - region.labelAnchor[0], point[1] - region.labelAnchor[1]) > Math.min(b.width, b.height) * .2) {
        pieces.push({ id: `${region.regionId}-${index}`, assetId: index % 3 ? 'terrain.tree' : 'building.home',
          position: point, size: Math.min(b.width, b.height) * .14, detail: false });
      }
    }
  }
  const inRect = (p, [x, y, w, h]) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;
  const contains = p => Array.isArray(p) && p.every(Number.isFinite) && inRect(p, playBounds) &&
    pointInRegion(p, nura) && !obstacles.some(rect => inRect(p, rect));
  const boundaries = [...nura.polygons.flat(), ...obstacles.map(([x, y, w, h]) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]])];
  // Exact segment tests prevent crossing even a hole thinner than a movement step.
  const canTraverse = (from, to) => contains(from) && contains(to) && !boundaries.some(ring =>
    ring.some((point, index) => index > 0 && segmentsCross(from, to, ring[index - 1], point)));
  return { regions, pieces, walkable: { start, bounds: playBounds, contains, canTraverse }, playBounds,
    detailedRegion: nura, sourceStatus: geography.status,
    paths: geography.paths || [] };
}
