#!/usr/bin/env python3
"""Fetch real Astana municipal layers as WGS84 GeoJSON using only Python stdlib.

Queries are read-only. Coordinates are reprojected by the source ArcGIS server,
not hand-drawn. Features intersecting the bbox may extend beyond it; polygon
rings/holes and multipart topology are preserved. Source publication dates and
reuse terms are not stated by these public municipal services.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import ssl
import urllib.parse
import urllib.request

OUT = Path(__file__).resolve().parent
ROOT = 'https://gis.esaulet.kz/server/rest/services/'
BBOX = [71.220936,50.999912,71.728067,51.301212]
CORE = [71.38,51.08,71.49,51.17]
LAYERS = {
 'districts': ('Административные_районы',4,'district',None),
 'water': ('dop_sloi_geoportal_otkr',16,'water',BBOX),
 'roads-municipal': ('dop_sloi_geoportal_otkr',12,'road',BBOX),
 'green': ('Sloi_geoportala_otkrytiy_kontur_0702',26,'park',CORE),
 'buildings': ('dop_sloi_geoportal_otkr',18,'building',CORE),
}
CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem')

def read(url):
 url=urllib.parse.quote(url,safe=':/?&=%+,')
 req=urllib.request.Request(url,headers={'User-Agent':'AkimSimulatorHackathon/0.1','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=55,context=CTX) as response:
  data=json.load(response)
 if 'error' in data: raise RuntimeError(data['error'])
 return data

def write(name,data):
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def coordinates_2d(coordinates):
 if coordinates and isinstance(coordinates[0],(int,float)): return coordinates[:2]
 return [coordinates_2d(part) for part in coordinates]

def polygon_area(feature):
 def ring_area(ring):
  return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))) / 2
 geometry=feature['geometry']
 polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
 return sum(max(0,ring_area(p[0])-sum(ring_area(r) for r in p[1:])) for p in polygons if p)

def fetch(name):
 service,layer,kind,bbox=LAYERS[name]
 url=f'{ROOT}{service}/MapServer/{layer}'
 metadata=read(url+'?f=json')
 fields={field['name'].upper():field['name'] for field in metadata.get('fields',[])}
 # Query only cartographic labels, categories and IDs. No ownership/contact data.
 wanted=['OBJECTID','NAME','NAME_RU','NAME_KZ','NAME_KK','NAME_OBJECT','NAIMENOVANIE','NAIMENOV','REGION','KATO','TYPE','TIP']
 selected=[fields[key] for key in wanted if key in fields]
 display=metadata.get('displayField')
 if display and display not in selected: selected.append(display)
 params={'where':'1=1','outFields':','.join(selected) or '*','outSR':4326,'f':'geojson','returnGeometry':'true','returnZ':'false','returnM':'false','geometryPrecision':7,'orderByFields':fields.get('OBJECTID','OBJECTID')}
 if name=='green': params.update({'outFields':'OBJECTID','maxAllowableOffset':0.000015})
 if bbox: params.update({'geometry':','.join(map(str,bbox)),'geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects'})
 features=[]
 page_size=min(2000,metadata.get('maxRecordCount',2000))
 offset=0
 while True:
  params.update({'resultOffset':offset,'resultRecordCount':page_size})
  response=read(url+'/query?'+urllib.parse.urlencode(params))
  page=response.get('features',[])
  features.extend(page)
  print(name,'page',offset,'count',len(page),flush=True)
  if name=='green': break
  if not page or (len(page)<page_size and not response.get('exceededTransferLimit')): break
  offset+=len(page)
  if offset>=30000: raise RuntimeError('Unexpectedly large data set; inspect before extending bound')
 now=datetime.now(timezone.utc).isoformat()
 for feature in features:
  feature['geometry']['coordinates']=coordinates_2d(feature['geometry']['coordinates'])
  prop=feature.setdefault('properties',{})
  feature['id']=f'municipal-{name}-{prop.get(fields.get("OBJECTID","OBJECTID"),feature.get("id"))}'
  prop['kind']=kind
  prop['name']=next((str(prop.get(field)) for field in [display,fields.get('NAME_OBJECT'),fields.get('NAME')] if field and prop.get(field)),None)
  prop['source']='Astana municipal open geoportal'
  prop['source_url']=url
  prop['sourceId']='astana-municipal-'+name
  if name=='roads-municipal': prop['importance_weight']=2
  if name=='green': prop['name']='Озеленение'
 data={'type':'FeatureCollection','metadata':{'sourceId':'astana-municipal-'+name,'source':url,'retrievedAt':now,'publicationDate':None,'geometryStatus':'source-geometry','boundaryCurrency':'unverified' if kind=='district' else None,'license':metadata.get('copyrightText') or None,'reuseTerms':'Not stated by service; source attribution retained.','sourceCrs':metadata.get('sourceSpatialReference'),'outputCrs':'EPSG:4326','queryBbox':bbox,'bboxClipped':False,'featureCount':len(features),'layerName':metadata.get('name')},'features':features}
 data['metadata']['coordinateDimensions']='Source Z discarded; [longitude, latitude] retained unchanged.'
 if name=='buildings':
  data['features']=sorted(features,key=lambda f:(-polygon_area(f),str(f['id'])))[:2000]
  data['metadata'].update(sourceFeatureCount=len(features),featureCount=len(data['features']),renderSampleCap=2000,selection='Largest 2000 polygon areas within central query bbox; exact source coordinates retained')
 if name=='green': data['metadata'].update(renderSampleCap=2000,selection='First 2000 OBJECTID-ordered source polygons intersecting central bbox',generalizationToleranceDegrees=0.000015,note='Municipal green-space polygons, not a park inventory.')
 if name=='districts': data['metadata'].update(boundaryCurrency='outdated-four-districts',note='Only Алматы, Сарыарка, Байконур, Есиль are represented. No Нура/Сарайшық; not current six-district boundaries.')
 if name=='roads-municipal': data['metadata']['note']='Municipal road axes, not OSM classifications or live traffic. Source date not stated.'
 write(name+'.geojson',data)
 write(name+'-source.json',{k:metadata.get(k) for k in ['id','name','description','copyrightText','displayField','fields','extent','sourceSpatialReference','editingInfo','serviceItemId']})
 print('SAVED',name,len(features),'sample',features[0]['properties'] if features else None,flush=True)
 return data

def main():
 parser=argparse.ArgumentParser();parser.add_argument('layers',nargs='*',choices=list(LAYERS));args=parser.parse_args()
 selected=args.layers or list(LAYERS)
 with ThreadPoolExecutor(max_workers=4) as pool:
  futures={name:pool.submit(fetch,name) for name in selected}
  for name,future in futures.items():
   try:future.result()
   except Exception as error:print('FAILED',name,repr(error),flush=True)
 if (OUT/'water.geojson').exists() and (OUT/'green.geojson').exists():
  parts=[json.loads((OUT/f'{name}.geojson').read_text()) for name in ['water','green']]
  write('landscape.geojson',{'type':'FeatureCollection','metadata':{'sources':[part['metadata'] for part in parts]},'features':[feature for part in parts for feature in part['features']]})

if __name__=='__main__':main()
