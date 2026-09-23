import { createGeoData } from './geodata.js';
import { createBuildingTileSource, validateBuildingManifest } from './building-tiles.js';
export { BUILDING_TILE_PATHS } from './building-tiles.js';

// This same manifest is the server's exact public data allowlist.
export const ASTANA_MAP_FILES = Object.freeze({
  seed: '/scene/data/astana/astana-ai.json',
  landmarks: '/scene/data/astana/landmarks.geojson',
  landmarkPositions: '/scene/data/astana/landmark-positions.json',
  parks: '/scene/data/astana/parks.geojson',
  roads: '/scene/data/astana/roads.geojson',
  intersections: '/scene/data/astana/intersections.geojson',
  landscape: '/scene/data/astana/landscape-render.geojson',
  greenery: '/scene/data/astana/greenery-render.geojson',
  buildings: '/scene/data/astana/buildings-render.geojson',
  buildingManifest: '/scene/data/astana/buildings-manifest.json',
  trafficCorridors: '/scene/data/astana/traffic_corridors.json',
  majorRoads: '/scene/data/astana/major_roads.json',
  districts: '/scene/data/astana/districts-current.geojson',
});

/** Load the sourced WGS84 layers once, then adapt all of them in one projection. */
export async function loadAstanaMap({ fetchImpl = fetch, signal } = {}) {
  const entries = await Promise.all(Object.entries(ASTANA_MAP_FILES).map(async ([key, path]) => {
    const response = await fetchImpl(path, { signal });
    if (!response.ok) throw new Error(`MAP_RESOURCE_UNAVAILABLE:${path}`);
    const data = await response.json();
    if (key === 'buildingManifest') {
      validateBuildingManifest(data);
    } else if (key === 'landmarkPositions') {
      if (data?.schemaVersion !== 1 || !Array.isArray(data.positions)) throw new Error('INVALID_MAP_DATA:landmarkPositions');
    } else if (key === 'trafficCorridors' || key === 'majorRoads') {
      if (!Array.isArray(data)) throw new Error(`INVALID_MAP_DATA:${key}`);
    } else if (key !== 'seed' && (data?.type !== 'FeatureCollection' || !Array.isArray(data.features))) {
      throw new Error(`INVALID_MAP_DATA:${key}`);
    }
    return [key, data];
  }));
  const layers = Object.fromEntries(entries);
  const mapData = createGeoData(layers);
  const greenery = createGeoData({ seed: layers.seed, landscape: layers.greenery });
  mapData.landscape = [...mapData.landscape.filter(feature => !/park|green|forest|wood/.test(feature.kind)), ...greenery.landscape];
  mapData.greeneryCount = greenery.landscape.length;
  mapData.sourceStatus.greenery = greenery.sourceStatus.landscape;
  mapData.buildingCount = layers.buildingManifest.featureCount;
  mapData.createBuildingSource = ({ onChange } = {}) => createBuildingTileSource({
    manifest: layers.buildingManifest, seed: layers.seed, fallback: mapData.buildings, fetchImpl, onChange,
  });
  if (!mapData.roads.length) throw new Error('INVALID_MAP_DATA:roads');
  return mapData;
}
