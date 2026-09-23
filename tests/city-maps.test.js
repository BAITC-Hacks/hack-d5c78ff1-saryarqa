import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {CITIES,CITY_MAP_FILES} from '../scene/cities.js';
import {createSpatialIndex} from '../scene/spatial-index.js';
import {createAppServer} from '../server.js';

for(const city of Object.values(CITIES))test(`${city.id}: full local source snapshots preserve IDs, geographic rings and provenance`,()=>{
 for(const [layer,path]of Object.entries(CITY_MAP_FILES[city.id])){
  const collection=JSON.parse(gunzipSync(readFileSync(new URL('..'+path+'.gz',import.meta.url))));
  assert.equal(collection.metadata.featureCount,collection.features.length);
  assert.deepEqual(collection.metadata.queryBbox,city.bbox);
  assert.equal(collection.metadata.license,'ODbL-1.0');
  assert.ok(collection.metadata.osmTimestamp);assert.ok(collection.metadata.retrievedAt);
  assert.equal(new Set(collection.features.map(f=>f.id)).size,collection.features.length);
  let outsideOldCenter=0;
  for(const feature of collection.features){
   assert.match(feature.properties.source_url,/^https:\/\/www\.openstreetmap\.org\/(way|relation)\/\d+$/);
   const g=feature.geometry;
   const lines=g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():g.type==='LineString'?[g.coordinates]:g.coordinates;
   for(const line of lines){
    assert.ok(line.length>=(layer==='roads'?2:4));
    if(layer!=='roads')assert.deepEqual(line[0],line.at(-1));
    for(const point of line)assert.ok(point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90);
   }
   const [lon,lat]=lines[0][0];if(lon<71.38||lon>71.49||lat<51.08||lat>51.17)outsideOldCenter++;
  }
  if(city.id==='astana'&&layer==='buildings'){assert.ok(collection.features.length>60000);assert.ok(outsideOldCenter>30000);}
 }
});

test('spatial queries retain all visible buildings beyond the former 2600 cap',()=>{
 const features=Array.from({length:3500},(_,id)=>({id,box:{minX:id*.01,minY:0,maxX:id*.01+.005,maxY:1}}));
 features.push({id:'far',box:{minX:1000,minY:1000,maxX:1100,maxY:1100}});
 const index=createSpatialIndex(features,f=>f.box);
 assert.equal(index.query({minX:-1,minY:-1,maxX:40,maxY:2}).length,3500);
 assert.deepEqual(index.query({minX:1050,minY:1050,maxX:1060,maxY:1060}).map(f=>f.id),['far']);
 assert.equal(index.query({minX:500,minY:500,maxX:501,maxY:501}).length,0);
});

test('compressed city layers load at approved URLs and raw source manifests stay private',async t=>{
 const server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const path=CITY_MAP_FILES.shymkent.landscape;
 const zipped=await fetch(base+path,{headers:{'Accept-Encoding':'gzip'}});
 assert.equal(zipped.status,200);assert.equal(zipped.headers.get('content-encoding'),'gzip');
 const compressedJSON=await zipped.json();assert.ok(compressedJSON.features.length>0);
 const plain=await fetch(base+path,{headers:{'Accept-Encoding':'identity'}});
 assert.equal(plain.status,200);assert.equal(plain.headers.get('content-encoding'),null);assert.deepEqual(await plain.json(),compressedJSON);
 for(const privatePath of ['/scene/data/cities/astana-source.json',path+'.gz','/scene/data/cities/unknown-buildings.geojson'])assert.equal((await fetch(base+privatePath)).status,404);
});
