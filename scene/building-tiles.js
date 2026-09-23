import { createGeoData } from './geodata.js';

// Exact published paths, shared with the server. Raw source exports stay private.
export const BUILDING_TILE_PATHS = Object.freeze(Array.from({ length: 16 }, (_, index) =>
  `/scene/data/astana/buildings-tiles/r${Math.floor(index / 4)}-c${index % 4}.geojson`));
const intersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export function validateBuildingManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.kind !== 'building-tiles' || !Array.isArray(manifest.tiles)
    || manifest.tiles.length !== 16 || !Number.isInteger(manifest.featureCount) || manifest.featureCount < 1)
    throw new TypeError('INVALID_MAP_DATA:buildingManifest');
  const paths = new Set();
  for (const tile of manifest.tiles) {
    const path = `/scene/data/astana/${tile.path}`;
    if (!BUILDING_TILE_PATHS.includes(path) || paths.has(path) || tile.id !== tile.path?.match(/^buildings-tiles\/(r[0-3]-c[0-3])\.geojson$/)?.[1] || !Array.isArray(tile.bbox)
      || tile.bbox.length !== 4 || !tile.bbox.every(Number.isFinite) || tile.bbox[0] > tile.bbox[2] || tile.bbox[1] > tile.bbox[3]
      || !Number.isInteger(tile.featureCount) || tile.featureCount < 0) throw new TypeError('INVALID_MAP_DATA:buildingManifest');
    paths.add(path);
  }
  if (manifest.tiles.reduce((sum, tile) => sum + tile.featureCount, 0) !== manifest.featureCount)
    throw new TypeError('INVALID_MAP_DATA:buildingManifest');
  return manifest;
}

/** A mount owns its requests. Panning only loads intersecting tiles, two at a time. */
export function createBuildingTileSource({ manifest, seed, fallback = [], fetchImpl = fetch, onChange = () => {} }) {
  validateBuildingManifest(manifest);
  const controller = new AbortController(), loaded = new Map(), failed = new Set(), active = new Set();
  let wanted = [], destroyed = false, buildings = fallback;
  function rebuild() {
    const byId = new Map(fallback.map(feature => [feature.id, feature]));
    for (const tile of wanted) for (const feature of loaded.get(tile.id) || []) byId.set(feature.id, feature);
    buildings = [...byId.values()];
  }
  function pump() {
    if (destroyed) return;
    for (const tile of wanted) {
      if (active.size >= 2) break;
      if (loaded.has(tile.id) || active.has(tile.id) || failed.has(tile.id)) continue;
      active.add(tile.id);
      (async () => {
        try {
          const response = await fetchImpl(`/scene/data/astana/${tile.path}`, { signal: controller.signal });
          if (!response.ok) throw new Error('BUILDING_TILE_UNAVAILABLE');
          const collection = await response.json();
          if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)
            || collection.features.length !== tile.featureCount) throw new Error('INVALID_BUILDING_TILE');
          const data = createGeoData({ seed, buildings: collection });
          if (data.diagnostics.buildings.rejected) throw new Error('INVALID_BUILDING_GEOMETRY');
          if (!destroyed) loaded.set(tile.id, data.buildings);
        } catch (error) {
          if (!destroyed && error?.name !== 'AbortError') failed.add(tile.id);
        } finally {
          active.delete(tile.id);
          if (!destroyed) { rebuild(); pump(); onChange(); }
        }
      })();
    }
  }
  return {
    request(bounds) {
      if (destroyed) return;
      const next = manifest.tiles.filter(tile => tile.featureCount && intersects(tile.bbox, bounds));
      if (next.map(t => t.id).join('|') !== wanted.map(t => t.id).join('|')) { wanted = next; rebuild(); }
      pump();
    },
    getBuildings: () => buildings,
    getState: () => ({ total: manifest.featureCount, loadedTiles: loaded.size,
      pending: wanted.filter(tile => !loaded.has(tile.id) && !failed.has(tile.id)).length,
      failed: wanted.filter(tile => failed.has(tile.id)).length }),
    retry() { failed.clear(); pump(); },
    destroy() { destroyed = true; controller.abort(); loaded.clear(); active.clear(); buildings = []; },
  };
}
