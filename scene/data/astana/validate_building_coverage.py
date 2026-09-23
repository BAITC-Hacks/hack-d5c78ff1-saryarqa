#!/usr/bin/env python3
"""Validate complete building tiles locally, without fetching or dependencies."""
from pathlib import Path
import hashlib
import json
import math

ROOT=Path(__file__).resolve().parent

def points(value):
 if value and isinstance(value[0],(int,float)):yield value
 else:
  for part in value:yield from points(part)

def main():
 manifest=json.loads((ROOT/'buildings-manifest.json').read_text());ids=set();vertices=0;holes=0
 assert manifest['featureCount']==manifest['metadata']['sourceFeatureCount']
 assert manifest['metadata']['completeWithinQuery'] is True
 for tile in manifest['tiles']:
  path=ROOT/tile['path'];raw=path.read_bytes();collection=json.loads(raw)
  assert len(raw)==tile['bytes'] and hashlib.sha256(raw).hexdigest()==tile['sha256'],path
  assert len(collection['features'])==tile['featureCount']==collection['metadata']['featureCount'],path
  xmin,ymin,xmax,ymax=tile['bbox']
  for feature in collection['features']:
   assert feature['id'] not in ids,feature['id'];ids.add(feature['id'])
   geometry=feature['geometry'];assert geometry['type'] in ['Polygon','MultiPolygon']
   polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
   for polygon in polygons:
    assert polygon;holes+=len(polygon)-1
    for ring in polygon:
     assert len(ring)>=4 and ring[0]==ring[-1],feature['id']
   for coordinate in points(geometry['coordinates']):
    assert len(coordinate)==2 and all(math.isfinite(n) for n in coordinate),feature['id']
    x,y=coordinate;assert xmin<=x<=xmax and ymin<=y<=ymax,feature['id'];vertices+=1
 assert len(ids)==manifest['featureCount']==sum(tile['featureCount'] for tile in manifest['tiles'])
 north=ROOT/'buildings-north.geojson'
 if north.exists():
  source=json.loads(north.read_text());north_ids={feature['id'] for feature in source['features']}
  assert north_ids.issubset(ids),f'{len(north_ids-ids)} north features missing from city'
 print(f'Validated {len(ids):,} unique buildings across {len(manifest["tiles"])} tiles; {vertices:,} vertices; {holes:,} interior rings; checksums/counts/bounds match.')

if __name__=='__main__':main()
