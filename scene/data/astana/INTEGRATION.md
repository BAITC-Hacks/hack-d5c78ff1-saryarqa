# Acquired map geometry

All generated geometry uses WGS84 `[longitude, latitude]`. Municipal source Z
coordinates are discarded; no locations are invented. Project all layers with
the same planar projection and scale. A query selects intersecting features;
their actual vertices can extend beyond the seed bbox. Clip at rendering time,
not by dropping entire roads or rivers with an outlying vertex.

| File | Features | Content |
| --- | ---: | --- |
| `roads.geojson` | 1,802 | OSM motorway/trunk/primary/secondary way geometry |
| `intersections.geojson` | 150 | Ranked nodes shared by major-road ways (some ways lack names) |
| `landscape.geojson` | 3,129 | 1,129 municipal water polygons + 2,000 sampled central green-space polygons |
| `buildings.geojson` | 2,000 | Largest source footprints from central bbox `[71.38,51.08,71.49,51.17]` |
| `roads-municipal.geojson` | 1,913 | Alternative municipal road axes |
| `districts.geojson` | 8 | **Outdated four-district parts: not current six-district geography** |
| `districts-current.geojson` | 6 | Six named district contours from Hosted/raiony; effective date unknown |
| `landmark-positions.json` | 5 | OSM identity-checked display positions; original seed coordinates retained |
| `landmarks.geojson` | 17 | User-supplied sourced anchor points |
| `parks.geojson` | 5 | User-supplied park anchor points, not polygons |

GeoJSON geometry preserves Polygon/MultiPolygon rings and holes and
LineString/MultiLineString road parts. Municipal features have `id` plus
`properties.kind` (`road`, `water`, `park`, `building`, `district`), `name`,
`source`, `source_url`, `sourceId`, and original cartographic ID/name fields.
`park` means a municipal green-space polygon: it is not a verified park inventory.
The green-space sample is the first 2,000 OBJECTID-ordered polygons intersecting
the central bbox, generalized by the ArcGIS server at 0.000015 degrees.
Building selection is the largest 2,000 polygon areas among 24,765 central
features; it is a rendering sample, not a building count statistic.

OSM roads retain `osm_way_id`, `name`, `name_ru`, `name_kk`, `highway`, and
`importance_weight`. The weights are the supplied road-class priorities,
not traffic measurements. Intersections carry `osm_node_id`, `roads`,
`road_count`, `importance_score`. Their shared source query, snapshot timestamp,
retrieval timestamp, copyright URL and ODbL attribution are in `metadata`.

Municipal metadata records retrieval time, source service/layer, original CRS,
query bbox, selection caps and unknown publication date/reuse terms. The historical `districts.geojson`
layer names only Алматы, Сарыарка, Байконур, Есиль. Нура and Сарайшық are absent.
Do not convert this file into current six-district polygons or infer missing
districts from road attributes. Bounded OSM administrative queries timed out.

Reproduction needs only Python stdlib:

```sh
python3 scene/data/astana/build_osm_snapshot.py
python3 scene/data/astana/build_geography.py districts water roads-municipal green buildings
```

The first command replays the checked-in raw OSM response. Add `--fetch` to refresh
it from Overpass. The second command refreshes public municipal layers. Changing
source services may change counts; verify metadata and geometry again afterward.

The renderer loads `districts-current.geojson` from the separate Hosted/raiony
FeatureServer. Its six identities match the game contract; its effective date is
not verified. The old four-district layer is retained for provenance, never
rendered as current. Full metadata and reproducible query parameters are stored
in the current collection and `districts-current-source.json`.

`landmark-positions.json` refines five display anchors using identified OSM ways
or a named node. It retains the original coordinates and source, OSM identity,
version, timestamp, method, displacement and SHA256 of each checked-in XML under
`landmark-osm-source/`. Twelve other supplied landmark positions remain unverified.
The 150 road nodes are connectivity candidates, not surveyed traffic junctions.
