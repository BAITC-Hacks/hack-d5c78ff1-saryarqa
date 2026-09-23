import { createGeoData } from './geodata.js';

// This same manifest is the server's exact public data allowlist.
export const ASTANA_MAP_FILES = Object.freeze({
  seed: '/scene/data/astana/astana-ai.json',
  landmarks: '/scene/data/astana/landmarks.geojson',
  parks: '/scene/data/astana/parks.geojson',
  roads: '/scene/data/astana/roads.geojson',
  intersections: '/scene/data/astana/intersections.geojson',
  landscape: '/scene/data/astana/landscape-render.geojson',
  buildings: '/scene/data/astana/buildings-render.geojson',
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
    if (key === 'trafficCorridors' || key === 'majorRoads') {
      if (!Array.isArray(data)) throw new Error(`INVALID_MAP_DATA:${key}`);
    } else if (key !== 'seed' && (data?.type !== 'FeatureCollection' || !Array.isArray(data.features))) {
      throw new Error(`INVALID_MAP_DATA:${key}`);
    }
    return [key, data];
  }));
  const mapData = createGeoData(Object.fromEntries(entries));
  if (!mapData.roads.length) throw new Error('INVALID_MAP_DATA:roads');
  return mapData;
}
