#!/usr/bin/env python3
"""
Generate exact major-road geometry and ranked intersections for Astana.

Outputs:
  roads.geojson
  intersections.geojson

The script intentionally DOES NOT download shops, cafes, supermarkets or buildings.
It fetches only motorway/trunk/primary/secondary road ways from OpenStreetMap Overpass.

Usage:
    pip install -r requirements.txt
    python build_astana_osm.py
"""

from __future__ import annotations
import json
import time
from collections import defaultdict
from pathlib import Path
import requests

OUT = Path(__file__).resolve().parent

# Working urban bbox: south, west, north, east
BBOX = (50.999912, 71.220936, 51.301212, 71.728067)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]

ALLOWED_HIGHWAYS = ("motorway", "trunk", "primary", "secondary")
WEIGHT = {"motorway": 5, "trunk": 4, "primary": 3, "secondary": 2}
MAX_INTERSECTIONS = 150

QUERY = """
[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"]({south},{west},{north},{east});
);
out body;
>;
out skel qt;
""".format(
    south=BBOX[0], west=BBOX[1], north=BBOX[2], east=BBOX[3]
)

def fetch_overpass():
    headers = {"User-Agent": "AkimSimulatorHackathon/0.1"}
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"Fetching {endpoint} ...")
            r = requests.post(endpoint, data={"data": QUERY}, headers=headers, timeout=180)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            print(f"  failed: {e}")
            time.sleep(2)
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")

def clean_name(tags, way_id):
    return tags.get("name") or tags.get("name:ru") or tags.get("name:kk") or f"osm_way_{way_id}"

def main():
    data = fetch_overpass()

    nodes = {}
    ways = []
    for el in data["elements"]:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lon"], el["lat"])
        elif el["type"] == "way":
            hw = el.get("tags", {}).get("highway")
            if hw in ALLOWED_HIGHWAYS:
                ways.append(el)

    # Road geometry
    road_features = []
    # node -> distinct roads touching that node
    node_roads = defaultdict(dict)

    for w in ways:
        tags = w.get("tags", {})
        name = clean_name(tags, w["id"])
        hw = tags.get("highway")
        coords = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
        if len(coords) < 2:
            continue

        road_features.append({
            "type": "Feature",
            "id": f"osm_way_{w['id']}",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "osm_way_id": w["id"],
                "name": name,
                "highway": hw,
                "importance_weight": WEIGHT[hw],
            },
        })

        # Count each named road once per node.
        for nid in w.get("nodes", []):
            if nid in nodes:
                key = name
                node_roads[nid][key] = max(node_roads[nid].get(key, 0), WEIGHT[hw])

    intersections = []
    for nid, road_weights in node_roads.items():
        # We want intersections between distinct road names, not merely split OSM way segments.
        if len(road_weights) < 2:
            continue
        lon, lat = nodes[nid]
        score = len(road_weights) * 10 + sum(road_weights.values())
        intersections.append({
            "node_id": nid,
            "lon": lon,
            "lat": lat,
            "roads": sorted(road_weights.keys()),
            "importance_score": score,
            "road_count": len(road_weights),
        })

    intersections.sort(
        key=lambda x: (x["importance_score"], x["road_count"]),
        reverse=True
    )
    intersections = intersections[:MAX_INTERSECTIONS]

    roads_fc = {"type": "FeatureCollection", "features": road_features}
    intersections_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": f"osm_node_{x['node_id']}",
                "geometry": {"type": "Point", "coordinates": [x["lon"], x["lat"]]},
                "properties": {
                    "osm_node_id": x["node_id"],
                    "roads": x["roads"],
                    "road_count": x["road_count"],
                    "importance_score": x["importance_score"],
                },
            }
            for x in intersections
        ],
    }

    (OUT / "roads.geojson").write_text(
        json.dumps(roads_fc, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT / "intersections.geojson").write_text(
        json.dumps(intersections_fc, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"Saved {len(road_features)} road segments -> roads.geojson")
    print(f"Saved {len(intersections)} intersections -> intersections.geojson")
    print("No shops/cafes/buildings were downloaded.")

if __name__ == "__main__":
    main()
