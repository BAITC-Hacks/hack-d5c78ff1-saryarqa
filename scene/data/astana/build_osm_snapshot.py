#!/usr/bin/env python3
"""Reproduce user's OSM major-road selection with Python stdlib and provenance.

Default replays checked-in osm-major-roads-response.json. --fetch refreshes it
with the exact road query/class/bbox from supplied build_astana_osm.py.
"""
import argparse
from collections import defaultdict
from datetime import datetime,timezone
import json
from pathlib import Path
import ssl
import urllib.parse
import urllib.request

OUT=Path(__file__).resolve().parent
ENDPOINT='https://overpass-api.de/api/interpreter'
QUERY='[out:json][timeout:120];(way["highway"~"^(motorway|trunk|primary|secondary)$"](50.999912,71.220936,51.301212,71.728067););out body;>;out skel qt;'
WEIGHTS={'motorway':5,'trunk':4,'primary':3,'secondary':2}

def write(name,data):
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args()
 raw=OUT/'osm-major-roads-response.json'
 if args.fetch:
  req=urllib.request.Request(ENDPOINT,data=urllib.parse.urlencode({'data':QUERY}).encode(),headers={'User-Agent':'AkimSimulatorHackathon/0.1'})
  with urllib.request.urlopen(req,timeout=150,context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')) as response:data=json.load(response)
  data['retrievedAt']=datetime.now(timezone.utc).isoformat();write(raw.name,data)
 else:data=json.loads(raw.read_text())
 nodes={el['id']:[el['lon'],el['lat']] for el in data['elements'] if el['type']=='node'}
 node_roads=defaultdict(dict);roads=[]
 for el in data['elements']:
  tags=el.get('tags',{});highway=tags.get('highway')
  if el['type']!='way' or highway not in WEIGHTS:continue
  coords=[nodes[n] for n in el.get('nodes',[]) if n in nodes]
  if len(coords)<2:continue
  name=tags.get('name') or tags.get('name:ru') or tags.get('name:kk') or f"osm_way_{el['id']}"
  roads.append({'type':'Feature','id':f"osm_way_{el['id']}",'geometry':{'type':'LineString','coordinates':coords},'properties':{'osm_way_id':el['id'],'name':name,'name_ru':tags.get('name:ru'),'name_kk':tags.get('name:kk'),'highway':highway,'importance_weight':WEIGHTS[highway],'kind':'road','source':'OpenStreetMap contributors','sourceId':'osm-major-roads','source_url':f"https://www.openstreetmap.org/way/{el['id']}"}})
  for nid in el.get('nodes',[]):
   if nid in nodes:node_roads[nid][name]=max(node_roads[nid].get(name,0),WEIGHTS[highway])
 intersections=[]
 for nid,weights in node_roads.items():
  if len(weights)<2:continue
  intersections.append({'type':'Feature','id':f'osm_node_{nid}','geometry':{'type':'Point','coordinates':nodes[nid]},'properties':{'osm_node_id':nid,'roads':sorted(weights),'road_count':len(weights),'importance_score':len(weights)*10+sum(weights.values()),'source':'OpenStreetMap contributors','sourceId':'osm-major-roads','source_url':f'https://www.openstreetmap.org/node/{nid}'}})
 intersections.sort(key=lambda f:(-f['properties']['importance_score'],-f['properties']['road_count'],f['id']))
 metadata={'sourceId':'osm-major-roads','source':ENDPOINT,'retrievedAt':data.get('retrievedAt'),'osmTimestamp':data.get('osm3s',{}).get('timestamp_osm_base'),'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','copyrightUrl':'https://www.openstreetmap.org/copyright','outputCrs':'EPSG:4326','queryBbox':[71.220936,50.999912,71.728067,51.301212],'bboxClipped':False,'query':QUERY,'note':'Road geometry and topology only; derived importance weights are not live traffic.'}
 write('roads.geojson',{'type':'FeatureCollection','metadata':metadata,'features':roads})
 write('intersections.geojson',{'type':'FeatureCollection','metadata':{**metadata,'sampleCap':150,'selection':'Top derived named-road intersection importance; not every city junction.'},'features':intersections[:150]})
 print('Saved',len(roads),'OSM road segments and',min(150,len(intersections)),'ranked intersections')

if __name__=='__main__':main()
