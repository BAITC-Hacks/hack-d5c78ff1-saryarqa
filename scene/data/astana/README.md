# Astana Map Data — Akim Simulator MVP

The acquired real geometry snapshot and reproduction instructions are now
documented in **[INTEGRATION.md](INTEGRATION.md)**. It adds OSM roads/intersections
and municipal water, green-space and building geometry. The original supplied
seed documentation below is retained for context.

A deliberately small geodata seed for an AI-driven city simulator.

## What is already included

- `astana-ai.json` — compact source of truth for the LLM.
- `landmarks.geojson` — key city anchors only.
- `parks.geojson` — park anchor points only (not polygons).
- `major_roads.json` — curated main-road whitelist.
- `traffic_corridors.json/.csv` — historical high-load corridors used only as importance seeds.
- `preview.png` — quick visual sanity check.
- `build_astana_osm.py` — generates exact major-road lines and ranked intersections from OSM.
- `requirements.txt`
- `SOURCES.md`

## Generate real road geometry + intersections

```bash
cd astana-map-data
pip install -r requirements.txt
python build_astana_osm.py
```

This will create:

- `roads.geojson`
- `intersections.geojson` (top 150)

The script downloads ONLY OSM road classes:

- motorway
- trunk
- primary
- secondary

It intentionally ignores supermarkets, cafes, salons, buildings and other noisy POIs.

## Recommended architecture

```text
2GIS MapGL (visual basemap)
          +
our GeoJSON overlays
          |
          v
game backend
          |
          +--> astana-ai.json -> LLM
          |
          +--> roads/intersections/zones -> exact geometry
```

## Anti-hallucination contract for the LLM

The LLM never chooses latitude/longitude itself. It returns IDs:

```json
{
  "action": "build_school",
  "target_id": "zone_042",
  "reason": "..."
}
```

The backend validates `target_id`, checks allowed actions, and only then changes the map.

## Next step

After road/intersection generation, split the playable urban area into 500×500 m cells or
urban polygons. Store scores and `allowed_actions` per zone. Send only candidate zones to
the LLM, not the whole city.
