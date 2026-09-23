import { createGeoData } from './geodata.js';
import { CITIES, CITY_MAP_FILES } from './cities.js';
export { CITY_MAP_FILES } from './cities.js';

// This same manifest is the server's exact public data allowlist.
export const ASTANA_MAP_FILES = Object.freeze({
  seed: '/scene/data/astana/astana-ai.json',
  landmarks: '/scene/data/astana/landmarks.geojson',
  landmarkPositions: '/scene/data/astana/landmark-positions.json',
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
    if (key === 'landmarkPositions') {
      if (data?.schemaVersion !== 1 || !Array.isArray(data.positions)) throw new Error('INVALID_MAP_DATA:landmarkPositions');
    } else if (key === 'trafficCorridors' || key === 'majorRoads') {
      if (!Array.isArray(data)) throw new Error(`INVALID_MAP_DATA:${key}`);
    } else if (key !== 'seed' && (data?.type !== 'FeatureCollection' || !Array.isArray(data.features))) {
      throw new Error(`INVALID_MAP_DATA:${key}`);
    }
    return [key, data];
  }));
  const inputs = Object.fromEntries(entries);
  inputs.seed = { ...inputs.seed, working_bbox: { ...inputs.seed.working_bbox, value: CITIES.astana.bbox } };
  const mapData = createGeoData(inputs);
  mapData.city = CITIES.astana;
  if (!mapData.roads.length) throw new Error('INVALID_MAP_DATA:roads');
  return mapData;
}

const empty = () => ({type:'FeatureCollection',features:[]});
export async function loadCityMap(cityId, {fetchImpl=fetch,signal}={}) {
  const city=CITIES[cityId]; if(!city) throw new Error('UNKNOWN_CITY');
  const layers=await Promise.all(Object.entries(CITY_MAP_FILES[cityId]).map(async ([key,path])=>{
    const response=await fetchImpl(path,{signal});if(!response.ok)throw new Error('MAP_RESOURCE_UNAVAILABLE:'+path);
    const data=await response.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length)throw new Error('INVALID_MAP_DATA:'+key);
    return [key,data];
  }));
  const sourceLayers=Object.fromEntries(layers);
  let base={landmarks:empty(),parks:empty(),districts:empty(),intersections:empty(),majorRoads:[],trafficCorridors:[]};
  if(cityId==='astana'){
    const extras=await Promise.all(Object.entries(ASTANA_MAP_FILES).filter(([key])=>!['seed','roads','buildings','landscape'].includes(key)).map(async ([key,path])=>{
      const r=await fetchImpl(path,{signal});if(!r.ok)throw new Error('MAP_RESOURCE_UNAVAILABLE:'+path);return [key,await r.json()];
    }));base={...base,...Object.fromEntries(extras)};
  } else {
    base.landmarks={type:'FeatureCollection',features:[{type:'Feature',id:city.id+'-center',geometry:{type:'Point',coordinates:city.center},properties:{name:city.name,category:'city',importance:10,source:'OpenStreetMap',source_url:city.sourceUrl}}]};
  }
  const map=createGeoData({...base,...sourceLayers,seed:{working_bbox:{value:city.bbox},center:{lon:city.center[0],lat:city.center[1]}}});
  map.city=city;
  map.sources=Object.values(sourceLayers).map(layer=>layer.metadata);
  if(!map.roads.length||!map.buildings.length)throw new Error('EMPTY_CITY_GEOMETRY');
  return map;
}
