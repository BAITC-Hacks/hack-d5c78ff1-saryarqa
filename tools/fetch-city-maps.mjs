/** Refresh locally served city geometry; no browser dependencies or invented coordinates.
 * node tools/fetch-city-maps.mjs [astana|almaty|shymkent ...]
 * Converter: osmtogeojson 3.0.0-beta.5, MIT, vendored beside this script.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import osmToGeoJSON from './vendor/osmtogeojson.cjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=root+'scene/data/cities/';const cache=root+'.codex-private/osm-city-cache/';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(cache,{recursive:true});
const endpoint='https://overpass-api.de/api/interpreter';
const headers={'User-Agent':'Saryarqa-Akim-CitySimulator/0.1 (https://github.com/BAITC-Hacks/hack-d5c78ff1-saryarqa)','Accept':'application/json'};
const configs={
 astana:{name:'Астана',center:[71.4304,51.1282],bbox:[71.2179,50.8575,71.7849,51.3511],boundsSource:'../astana/districts-current.geojson'},
 almaty:{name:'Алматы',center:[76.9457275,43.2363924],bbox:[76.7420485,43.0328438,77.1667539,43.4037657],boundsSource:'https://www.openstreetmap.org/relation/2465058',centerSource:'https://www.openstreetmap.org/node/26544289'},
 shymkent:{name:'Шымкент',center:[69.5883282,42.3146962],bbox:[69.30185,42.1090168,69.9357152,42.4794403],boundsSource:'https://www.openstreetmap.org/relation/3389772',centerSource:'https://www.openstreetmap.org/node/1466716533'}
};
const filters={buildings:['["building"]["building"!="no"]'],roads:['["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|footway|cycleway|path|steps|track|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]["area"!="yes"]'],landscape:['["natural"~"^(water|wood|scrub|grassland|wetland)$"]','["landuse"~"^(grass|forest|meadow|recreation_ground|village_green)$"]','["leisure"~"^(park|garden|nature_reserve)$"]','["waterway"="riverbank"]']};
const write=(path,data)=>fs.writeFileSync(path,JSON.stringify(data)+'\n');
async function fetchLayer(city,layer,c){
 const box=[c.bbox[1],c.bbox[0],c.bbox[3],c.bbox[2]].join(',');
 const query=`[out:json][timeout:180];(${filters[layer].flatMap(f=>layer==='roads'?[`way${f}(${box});`]:[`way${f}(${box});`,`rel["type"="multipolygon"]${f}(${box});`]).join('')});out body geom;`;
 const path=cache+city+'-'+layer+'.json.gz';let raw;
 if(fs.existsSync(path))raw=JSON.parse(gunzipSync(fs.readFileSync(path)));
 else{
  for(let attempt=0;attempt<4;attempt++){
   try{console.log('Fetching',city,layer,'attempt',attempt+1);const r=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{headers,signal:AbortSignal.timeout(210000)});const body=await r.text();if(!r.ok)throw Error(`HTTP ${r.status}: ${body.slice(0,180)}`);const d=JSON.parse(body);if(d.remark||!Array.isArray(d.elements))throw Error(d.remark||'Invalid response');raw={query,retrievedAt:new Date().toISOString(),data:d};fs.writeFileSync(path,gzipSync(JSON.stringify(raw)));break}catch(e){console.log('Retry',city,layer,e.message.slice(0,180));if(attempt===3)throw e;await new Promise(r=>setTimeout(r,10000*(attempt+1)));}
  }
 }
 if(raw.query!==query)throw Error('Cached query differs: '+path);
 const collection=osmToGeoJSON(raw.data,{flatProperties:false});let rejected=0;
 const features=collection.features.flatMap(f=>{
  const p=f.properties,t=p.tags||{};const polygon=['Polygon','MultiPolygon'].includes(f.geometry?.type),line=['LineString','MultiLineString'].includes(f.geometry?.type);
  if(p.tainted){rejected++;return []}
  if(layer==='roads'?!line||!t.highway:!polygon)return [];
  const kind=layer==='landscape'?((t.natural==='water'||t.water||t.waterway==='riverbank')?'water':'park'):layer==='buildings'?'building':'road';
  return [{type:'Feature',id:'osm_'+f.id.replace('/','_'),geometry:f.geometry,properties:{kind,name:t['name:ru']||t.name||t['name:kk']||null,...(layer==='roads'?{highway:t.highway,importance_weight:({motorway:5,trunk:4,primary:3,secondary:2})[t.highway]||1}:{}),source:'OpenStreetMap contributors',sourceId:'osm-'+city+'-'+layer,source_url:'https://www.openstreetmap.org/'+f.id}}];
 });
 if(!features.length||rejected)throw Error(`Incomplete ${city}/${layer}: ${features.length} features, ${rejected} tainted geometries`);
 const metadata={sourceId:'osm-'+city+'-'+layer,source:endpoint,query,queryBbox:c.bbox,boundsSource:c.boundsSource,retrievedAt:raw.retrievedAt,osmTimestamp:raw.data.osm3s?.timestamp_osm_base,license:'ODbL-1.0',copyrightUrl:'https://www.openstreetmap.org/copyright',attribution:'© OpenStreetMap contributors',outputCrs:'EPSG:4326',geometryStatus:'source-geometry',featureCount:features.length,sourceElementCount:raw.data.elements.length,rawSha256:createHash('sha256').update(JSON.stringify(raw.data)).digest('hex'),selection:'All returned matching OSM features in the city boundary envelope; no feature cap; source rings and multipolygons retained',converter:'osmtogeojson@3.0.0-beta.5',note:'Snapshot coverage depends on OSM mapping. No coordinates or missing buildings are invented.'};
 fs.writeFileSync(out+city+'-'+layer+'.geojson.gz',gzipSync(JSON.stringify({type:'FeatureCollection',metadata,features})+'\n',{level:9}));console.log('Saved',city,layer,features.length,'features');return metadata;
}
for(const city of (process.argv.slice(2).length?process.argv.slice(2):Object.keys(configs))){
 const c=configs[city];if(!c)throw Error('Unknown city '+city);
 const sources={};for(const layer of ['roads','buildings','landscape'])sources[layer]=await fetchLayer(city,layer,c);
 write(out+city+'-source.json',{schemaVersion:1,city,...c,sources});
}
