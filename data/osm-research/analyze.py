import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
FILES = ('saryarka.json', 'baikonur.json', 'yesil.json', 'nura.json', 'almaty.json', 'saraishyk.json')
R = 6_378_137
LAT0 = math.radians(51.17)


def ring_area(ring):
    points = [(math.radians(lon) * R * math.cos(LAT0), math.radians(lat) * R) for lon, lat in ring]
    return abs(sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points)))) / 2


def polygon_area(geometry):
    if not geometry or geometry['type'] not in ('Polygon', 'MultiPolygon'):
        return None
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    return sum(ring_area(poly[0]) - sum(ring_area(hole) for hole in poly[1:]) for poly in polygons) / 10_000


for filename in FILES:
    items = json.loads((ROOT / filename).read_text(encoding='utf-8'))
    print(filename, 'results', len(items))
    for item in items:
        if item.get('osm_type') == 'relation' and item.get('category') == 'boundary':
            area = polygon_area(item.get('geojson'))
            print(' ', item['osm_id'], item['display_name'][:80], item.get('type'), item.get('geojson', {}).get('type'), f'{area:.0f} ha' if area else 'no polygon')
