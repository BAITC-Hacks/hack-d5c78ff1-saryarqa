#!/usr/bin/env python3
"""Download complete source building coverage by bbox, never an area-ranked sample.

Python stdlib only. Source ArcGIS transforms coordinates to WGS84 and generalizes
by 0.000009 degrees (at most about 1m in latitude near Astana). Ring topology,
feature IDs and available building-purpose/storey data are retained. Source
currency/reuse terms are unknown. Only public cartographic fields are requested.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
import json
import hashlib
import math
from pathlib import Path
import ssl
import time
import urllib.parse
import urllib.request

OUT=Path(__file__).resolve().parent
SOURCE='https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer/18'
AREAS={'north':[71.37,51.175,71.445,51.22],'city':[71.220936,50.999912,71.728067,51.301212]}
FIELDS='OBJECTID,NAME,NAME_OBJECT,NUMBER_STOREYS,FUNCTIONAL,PURPOSE'
CTX=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
TOLERANCE=0.000009
PAGE=2000

def read(params):
 url=SOURCE+'/query?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'AkimSimulatorHackathon/0.1','Accept':'application/json'})
   with urllib.request.urlopen(req,timeout=50,context=CTX) as response:data=json.load(response)
   if 'error' in data:raise RuntimeError(data['error'])
   return data
  except Exception:
   if attempt==2:raise
   time.sleep(1)

def xy(coords):
 if coords and isinstance(coords[0],(int,float)):
  point=coords[:2]
  if not all(math.isfinite(value) for value in point) or not (70<point[0]<73 and 50<point[1]<53):raise ValueError('Invalid source coordinate')
  return point
 return [xy(part) for part in coords]

def validate(feature):
 geometry=feature.get('geometry')
 if not geometry or geometry['type'] not in ['Polygon','MultiPolygon']:return False
 polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
 return bool(polygons) and all(p and all(len(r)>=4 and r[0]==r[-1] for r in p) for p in polygons)

def feature_bounds(feature):
 coordinates=feature['geometry']['coordinates']
 def points(value):
  if value and isinstance(value[0],(int,float)):yield value
  else:
   for part in value:yield from points(part)
 minimum_x=minimum_y=math.inf;maximum_x=maximum_y=-math.inf
 for x,y in points(coordinates):
  minimum_x=min(minimum_x,x);minimum_y=min(minimum_y,y)
  maximum_x=max(maximum_x,x);maximum_y=max(maximum_y,y)
 return [minimum_x,minimum_y,maximum_x,maximum_y]

def write_tiles(features,metadata):
 west,south,east,north=metadata['queryBbox'];buckets={(row,col):[] for row in range(4) for col in range(4)}
 seed=json.loads((OUT/'astana-ai.json').read_text())
 anchors={item['id']:[item['lon'],item['lat']] for item in seed.get('landmarks',[]) if item['id'] in ['astana_1_station','nurly_zhol_station','astana_airport','baiterek']}
 coverage={key:0 for key in anchors}
 for feature in features:
  x1,y1,x2,y2=feature_bounds(feature)
  for key,(x,y) in anchors.items():
   dx=.2/(111.32*math.cos(math.radians(y)));dy=.2/111.32
   if x1<x+dx and x2>x-dx and y1<y+dy and y2>y-dy:coverage[key]+=1
  col=max(0,min(3,int(((x1+x2)/2-west)/(east-west)*4)))
  row=max(0,min(3,int(((y1+y2)/2-south)/(north-south)*4)))
  # The source ID is already in feature.id. Shared provenance belongs to the collection.
  props=feature['properties']
  props.pop('OBJECTID',None);props.pop('sourceId',None);props.pop('kind',None)
  if props.get('name')=='Здание':props.pop('name')
  buckets[row,col].append(feature)
 metadata.update(generator='build_building_tiles.py',sourceMetadataFile='buildings-source.json',schemaVersion=1)
 metadata['coverageChecks']={'method':'Feature bboxes intersecting a 400m by400m WGS84-local rectangle centered on user-supplied anchor. No features generated from anchors.','featuresByAnchor':coverage}
 directory=OUT/'buildings-tiles';directory.mkdir(exist_ok=True);tiles=[]
 for (row,col),items in buckets.items():
  grid=[west+(east-west)*col/4,south+(north-south)*row/4,west+(east-west)*(col+1)/4,south+(north-south)*(row+1)/4]
  bounds=[feature_bounds(feature) for feature in items]
  actual=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)] if bounds else grid
  tile_id=f'r{row}-c{col}';path=directory/f'{tile_id}.geojson'
  result={'type':'FeatureCollection','source':'Astana municipal open geoportal','source_url':SOURCE,'metadata':{**metadata,'featureCount':len(items),'tileId':tile_id,'tileBbox':actual,'gridBbox':grid,'completeWithinQuery':False,'completeCollectionWithinQuery':True,'selection':'Tile subset of complete city coverage; full features assigned once by bbox center.'},'features':items}
  payload=(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8');path.write_bytes(payload)
  tiles.append({'id':tile_id,'path':f'buildings-tiles/{tile_id}.geojson','bbox':actual,'gridBbox':grid,'featureCount':len(items),'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
 manifest={'schemaVersion':1,'kind':'building-tiles','crs':'EPSG:4326','source':'Astana municipal open geoportal','source_url':SOURCE,'metadata':metadata,'queryBbox':metadata['queryBbox'],'featureCount':len(features),'tileAssignment':'4x4 query-bbox grid; full source feature assigned once by its bbox center. Tile bbox contains all assigned geometry.','tiles':tiles}
 (OUT/'buildings-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('SAVED tiles',len(tiles),'features',len(features),'bytes',sum(tile['bytes'] for tile in tiles),'largest',max(tile['bytes'] for tile in tiles),flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('area',choices=AREAS);parser.add_argument('--count-only',action='store_true');args=parser.parse_args()
 bbox=AREAS[args.area]
 base={'where':'1=1','geometry':','.join(map(str,bbox)),'geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects'}
 count=read({**base,'returnCountOnly':'true','f':'json'})['count'];print(args.area,'source count',count,flush=True)
 if args.count_only:return
 def page(offset):
  response=read({**base,'outFields':FIELDS,'outSR':4326,'f':'geojson','returnGeometry':'true','returnZ':'false','returnM':'false','geometryPrecision':7,'maxAllowableOffset':TOLERANCE,'orderByFields':'OBJECTID','resultOffset':offset,'resultRecordCount':PAGE})
  features=response.get('features',[]);print(args.area,'page',offset,'features',len(features),flush=True);return offset,features
 chunks={}
 with ThreadPoolExecutor(max_workers=3) as pool:
  futures=[pool.submit(page,offset) for offset in range(0,count,PAGE)]
  for future in as_completed(futures):
   offset,features=future.result();chunks[offset]=features
 features=[feature for offset in sorted(chunks) for feature in chunks[offset]]
 assert len(features)==count,(len(features),count)
 assert len({f['properties']['OBJECTID'] for f in features})==count,'Duplicate source IDs'
 repaired=0
 for feature in features:
  if not validate(feature):
   replacement=read({'objectIds':feature['properties']['OBJECTID'],'outFields':FIELDS,'outSR':4326,'f':'geojson','returnGeometry':'true','geometryPrecision':7})['features'][0]
   if not validate(replacement):raise ValueError(f"Invalid raw source geometry {feature['properties']['OBJECTID']}")
   feature.update(replacement);repaired+=1
  feature['geometry']['coordinates']=xy(feature['geometry']['coordinates'])
  original=feature['properties'];object_id=original['OBJECTID']
  feature['id']=f'municipal-buildings-{object_id}'
  feature['properties']={'OBJECTID':object_id,'kind':'building','sourceId':'astana-municipal-buildings','name':original.get('NAME_OBJECT') or original.get('NAME') or 'Здание'}
  for source,target in [('NUMBER_STOREYS','storeys'),('FUNCTIONAL','functional'),('PURPOSE','purpose')]:
   if original.get(source):feature['properties'][target]=original[source]
  if original.get('NUMBER_STOREYS'):
   try:
    levels=float(original['NUMBER_STOREYS'])
    if 0<levels<200:feature['properties']['levels']=levels
   except (ValueError,TypeError):pass
 now=datetime.now(timezone.utc).isoformat()
 metadata={'sourceId':'astana-municipal-buildings','source':SOURCE,'retrievedAt':now,'publicationDate':None,'geometryStatus':'sourced','status':'unverified','license':None,'reuseTerms':'Not stated by public source service.','outputCrs':'EPSG:4326','coordinateDimensions':'Source Z discarded; longitude and latitude retained.','queryBbox':bbox,'bboxClipped':False,'sourceFeatureCount':count,'featureCount':len(features),'completeWithinQuery':True,'renderSampleCap':None,'selection':'Every source building polygon intersecting query bbox, ordered by OBJECTID; no largest-area sampling.','generalizationToleranceDegrees':TOLERANCE,'invalidGeneralizedFeaturesReplacedByRaw':repaired,'fields':FIELDS}
 metadata['query']={**base,'outFields':FIELDS,'outSR':4326,'f':'geojson','returnGeometry':'true','returnZ':'false','returnM':'false','geometryPrecision':7,'maxAllowableOffset':TOLERANCE,'orderByFields':'OBJECTID','resultRecordCount':PAGE}
 if args.area=='city':write_tiles(features,metadata)
 else:
  result={'type':'FeatureCollection','source':'Astana municipal open geoportal','source_url':SOURCE,'metadata':metadata,'features':features}
  path=OUT/f'buildings-{args.area}.geojson';path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
  print('SAVED',path.name,len(features),'features;',path.stat().st_size,'bytes; repaired',repaired,flush=True)
 (OUT/f'buildings-{args.area}-source.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
