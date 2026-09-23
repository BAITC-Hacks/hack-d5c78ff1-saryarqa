#!/usr/bin/env python3
from __future__ import annotations
import json
import time
from collections import defaultdict
from pathlib import Path
import requests

OUT = Path(__file__).resolve().parent

BBOX = (50.999912, 71.220936, 51.301212, 71.728067)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
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
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            r = requests.post(endpoint, data={"data": QUERY}, headers=headers, timeout=180)
            r.raise_for_status()
            return r.json()
        except Exception:
            pass
    raise RuntimeError("Failed")

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

    road_features = []
    node_roads = defaultdict(dict)

    for w in ways:
        tags = w.get("tags", {})
        name = clean_name(tags, w["id"])
        hw = tags.get("highway")
        coords = [nodes[nid] for nid in w.get("nodes", []) if nid in nodes]
        if len(coords) < 2: continue

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

        for nid in w.get("nodes", []):
            if nid in nodes:
                key = name
                node_roads[nid][key] = max(node_roads[nid].get(key, 0), WEIGHT[hw])

    intersections = []
    for nid, road_weights in node_roads.items():
        if len(road_weights) < 2: continue
        lon, lat = nodes[nid]
        score = len(road_weights) * 10 + sum(road_weights.values())
        intersections.append({
            "node_id": nid, "lon": lon, "lat": lat,
            "roads": sorted(road_weights.keys()),
            "importance_score": score,
            "road_count": len(road_weights),
        })

    intersections.sort(key=lambda x: (x["importance_score"], x["road_count"]), reverse=True)
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

    (OUT / "roads.geojson").write_text(json.dumps(roads_fc, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "intersections.geojson").write_text(json.dumps(intersections_fc, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
