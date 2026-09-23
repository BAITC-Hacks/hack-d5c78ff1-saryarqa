# Complete building coverage

`buildings-manifest.json` indexes **125,832** source building features in the
seed bbox `[71.220936, 50.999912, 71.728067, 51.301212]`. They are split across
16 geographic tiles totaling about 46.7 MB. No largest-area selection or other
feature-count cap is applied. This replaces the earlier central sample for
coverage; it is not a claim that the source is a current building inventory.

The source is the public municipal layer
`https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer/18`.
It was queried in OBJECTID order, 2,000 features per batch, with three concurrent
requests. The complete output count equals the independent service count.
Publication date and reuse terms are not stated by that service.

ArcGIS performs the WGS84 transformation and 0.000009-degree generalization
(about one metre in latitude). Polygon parts and inner rings remain represented.
The source Z value is discarded. Each source ID becomes
`municipal-buildings-<OBJECTID>` and occurs exactly once across the tiles.
Available public `name`, `purpose`, `functional`, `storeys`, and numeric `levels`
are preserved; absent levels are unknown rather than inferred height.

Each feature is assigned by its full geometry bbox centre to a 4×4 grid. A tile's
`bbox` is the actual extent of every assigned feature, while `gridBbox` is the
assignment cell. Use the **actual bbox** when deciding which tiles to load.
Some tiles contain no buildings; their finite bbox is the grid extent.
Features crossing grid or seed boundaries retain their complete geometry.

Tile paths are relative to the manifest. Each entry supplies its feature count,
byte count, and SHA-256 checksum. Shared source information is on the collection
and in `buildings-city-source.json`; it is not repeated in every feature.

Coverage checks use feature bboxes intersecting a 400×400 m rectangle around
the user's supplied anchors, without generating any geometry from those points:

| Anchor | Source features |
| --- | ---: |
| Astana-1 railway station | 61 |
| Nurly Zhol railway station | 23 |
| Astana airport | 1 |
| Baiterek | 29 |

Source station footprints include IDs `municipal-buildings-30863` through
`municipal-buildings-30866`. Their source labels still use an older city name;
this is retained as source data rather than silently rewritten.

Refresh and validate with Python stdlib:

```sh
python3 scene/data/astana/build_building_tiles.py city
python3 scene/data/astana/validate_building_coverage.py
```

Validation checks all IDs, counts, checksums, WGS84 coordinates, closed rings,
and actual tile extents. The existing geographic adapter accepts all 125,832
features with zero rejected features. Load tiles on demand and use viewport
culling/detail levels: the largest tile is about 19.3 MB.
