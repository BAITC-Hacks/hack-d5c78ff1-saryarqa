#!/usr/bin/env python3
"""Render actual OSM park/wood polygons plus the retained municipal green sample.

Without --fetch, reproducibly converts the checked-in Overpass response. Never
builds outlines from point anchors. Open member chains cause an explicit failure,
not an invented closing edge. Relations preserve all outer parts and inner rings.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse
import hashlib
import json
import math
import ssl
import urllib.parse
import urllib.request

OUT=Path(__file__).resolve().parent
BBOX=[71.220936,50.999912,71.728067,51.301212]
ENDPOINT='https://overpass-api.de/api/interpreter'
QUERY='[out:json][timeout:25];('+''.join(f'{kind}[{selector}](50.999912,71.220936,51.301212,71.728067);' for kind in ['way','relation'] for selector in ['"leisure"~"^(park|garden)$"','"landuse"="forest"','"natural"="wood"'])+');out geom;'

def coordinates(geometry):
 return [[point['lon'],point['lat']] for point in geometry]

def stitch(segments):
 pending=[segment[:] for segment in segments];rings=[]
 while pending:
  ring=pending.pop(0)
  while ring[0]!=ring[-1]:
   for index,segment in enumerate(pending):
    if segment[0]==ring[-1]:ring+=segment[1:]
    elif segment[-1]==ring[-1]:ring+=segment[-2::-1]
    elif segment[-1]==ring[0]:ring=segment[:-1]+ring
    elif segment[0]==ring[0]:ring=list(reversed(segment[1:]))+ring
    else:continue
    pending.pop(index);break
   else:raise ValueError('Source relation has an unclosed member chain')
  if len(ring)<4:raise ValueError('Source ring has fewer than four coordinates')
  rings.append(ring)
 return rings

def inside(point,ring):
 x,y=point;result=False
 for a,b in zip(ring,ring[1:]):
  if (a[1]>y)!=(b[1]>y) and x<a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]):result=not result
 return result

def area(ring):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))) / 2

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args();raw_path=OUT/'osm-greenery-response.json'
 if args.fetch:
  req=urllib.request.Request(ENDPOINT,data=urllib.parse.urlencode({'data':QUERY}).encode(),headers={'User-Agent':'AkimSimulatorHackathon/0.1'})
  with urllib.request.urlopen(req,timeout=40,context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')) as response:data=json.load(response)
  data['retrievedAt']=datetime.now(timezone.utc).isoformat();raw_path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 else:data=json.loads(raw_path.read_text())
 converted=[];member_ids=set();unclosed=[]
 for element in sorted(data['elements'],key=lambda e:0 if e['type']=='relation' else 1):
  tags=element.get('tags',{})
  if element['type']=='relation':
   if tags.get('type')!='multipolygon':raise ValueError(f"Unsupported relation type {element['id']}")
   members=[m for m in element['members'] if m['type']=='way']
   outer=stitch([coordinates(m['geometry']) for m in members if m.get('role','') in ['', 'outer']])
   inner=stitch([coordinates(m['geometry']) for m in members if m.get('role')=='inner'])
   polygons=[[ring] for ring in outer]
   for ring in inner:
    candidates=[p for p in polygons if inside(ring[0],p[0])]
    if not candidates:raise ValueError(f"Inner ring lacks outer in {element['id']}")
    min(candidates,key=lambda p:area(p[0])).append(ring)
   member_ids.update(m['ref'] for m in members)
  else:
   if element['id'] in member_ids:continue
   ring=coordinates(element.get('geometry',[]))
   if len(ring)<4 or ring[0]!=ring[-1]:unclosed.append(element['id']);continue
   polygons=[[ring]]
  kind='forest' if tags.get('landuse')=='forest' else 'wood' if tags.get('natural')=='wood' else 'park'
  props={'kind':kind,'source':'OpenStreetMap contributors','sourceId':'osm-greenery','source_url':f"https://www.openstreetmap.org/{element['type']}/{element['id']}",'osmType':element['type'],'osmId':element['id']}
  for source,target in [('name','name'),('name:ru','name_ru'),('name:kk','name_kk'),('leisure','leisure'),('landuse','landuse'),('natural','natural'),('leaf_type','leaf_type'),('leaf_cycle','leaf_cycle')]:
   if source in tags:props[target]=tags[source]
  geometry={'type':'Polygon','coordinates':polygons[0]} if len(polygons)==1 else {'type':'MultiPolygon','coordinates':polygons}
  converted.append({'type':'Feature','id':f"osm-green-{element['type']}-{element['id']}",'properties':props,'geometry':geometry})
 municipal=json.loads((OUT/'green.geojson').read_text());features=converted+municipal['features']
 for feature in features:
  g=feature['geometry'];polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
  assert polygons
  for p in polygons:
   for ring in p:
    assert len(ring)>=4 and ring[0]==ring[-1]
    assert all(len(point)==2 and all(math.isfinite(v) for v in point) for point in ring)
 metadata={'schemaVersion':1,'outputCrs':'EPSG:4326','queryBbox':BBOX,'bboxClipped':False,'featureCount':len(features),'osmFeatureCount':len(converted),'municipalSampleCount':len(municipal['features']),'municipalFullQueryCount':57030,'municipalFullCoverage':False,'municipalFullCoverageNote':'Complete acquisition failed on source server query errors; only the original explicitly sampled 2000 municipal polygons are retained.','unclosedOsmWaysExcluded':unclosed,'sources':[{'sourceId':'osm-greenery','source':ENDPOINT,'query':QUERY,'retrievedAt':data.get('retrievedAt'),'osmTimestamp':data.get('osm3s',{}).get('timestamp_osm_base'),'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','copyrightUrl':'https://www.openstreetmap.org/copyright','geometry':'Source WGS84 rings unchanged; relation member ways stitched only at identical endpoints; holes assigned to containing outer rings.'},municipal['metadata']]}
 result={'type':'FeatureCollection','metadata':metadata,'features':features};payload=(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n').encode();(OUT/'greenery-render.geojson').write_bytes(payload)
 (OUT/'greenery-source.json').write_text(json.dumps({'metadata':metadata,'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload)},ensure_ascii=False,indent=2)+'\n')
 print('SAVED',len(converted),'OSM +',len(municipal['features']),'municipal =',len(features),'features;',len(payload),'bytes; excluded open ways',unclosed)
 print('Named parks:',[(f['id'],f['properties'].get('name')) for f in converted if f['properties'].get('name')])

if __name__=='__main__':main()
