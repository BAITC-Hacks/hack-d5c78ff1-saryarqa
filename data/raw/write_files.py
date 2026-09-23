import json

landmarks_geojson = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "baiterek",
      "geometry": {
        "type": "Point",
        "coordinates": [71.4256, 51.1283]
      },
      "properties": {
        "id": "baiterek",
        "name": "Бәйтерек",
        "category": "landmark",
        "importance": 5,
        "source": "Kazakhstan Travel",
        "kind": "landmark"
      }
    }
  ]
}

parks_geojson = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "botanical_garden",
      "geometry": {
        "type": "Point",
        "coordinates": [71.41657, 51.10617]
      },
      "properties": {
        "id": "botanical_garden",
        "name": "Ботанический сад",
        "importance": 5,
        "kind": "park_anchor"
      }
    }
  ]
}

astana_ai = {
  "schema_version": "0.1.0",
  "city": "Astana",
  "generated_for": "Akim Simulator MVP",
  "working_bbox": {
    "format": "[west,south,east,north]",
    "value": [71.220936, 50.999912, 71.728067, 51.301212]
  }
}

with open("data/raw/landmarks.geojson", "w") as f:
    json.dump(landmarks_geojson, f, ensure_ascii=False, indent=2)
with open("data/raw/parks.geojson", "w") as f:
    json.dump(parks_geojson, f, ensure_ascii=False, indent=2)
with open("data/raw/astana-ai.json", "w") as f:
    json.dump(astana_ai, f, ensure_ascii=False, indent=2)
