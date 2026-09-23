# City map snapshots

These files contain real OpenStreetMap coordinates. The user-facing palette is unchanged; no buildings or roads have been generated to fill unmapped space.

| City | Road sections | Building features | Water and green-space features |
| --- | ---: | ---: | ---: |
| Astana | 39,128 | 69,456 | 8,267 |
| Almaty | 69,824 | 274,729 | 16,846 |
| Shymkent | 23,767 | 206,936 | 612 |

Counts describe returned source features inside/intersecting each query envelope, including suburbs inside that rectangle. They are not official city statistics. Complete coverage means all matching returned OSM geometry in the query, not proof that every real building has been mapped.

## Sources

- [OpenStreetMap / ODbL](https://www.openstreetmap.org/copyright), snapshot timestamp and exact Overpass queries in each `*-source.json` and the compressed collections' metadata.
- Astana query envelope covers all six supplied municipal district contours in `../astana/districts-current.geojson`. District boundaries remain from the [Astana municipal geoportal](https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0); their effective date is unknown.
- [Almaty boundary](https://www.openstreetmap.org/relation/2465058), [city reference point](https://www.openstreetmap.org/node/26544289).
- [Shymkent boundary](https://www.openstreetmap.org/relation/3389772), [city reference point](https://www.openstreetmap.org/node/1466716533).

Each feature retains its OSM object ID and direct source URL. Collections record retrieval time, OSM timestamp, bounding box, exact query, raw-response SHA-256, conversion version and license. Polygon holes and multipolygons are preserved. OSM source completeness varies; natural empty areas remain empty. Only existing mapped streets, footpaths, buildings, water, woodland and green areas are displayed.

The official geoportal did not respond during this update. Earlier municipal raw data remains in `../astana/` for provenance. Current building, road and landscape layers use the city-wide OSM snapshot instead of the former central sample. Gameplay still uses the original Astana dataset; Almaty and Shymkent expose geographic browsing only.

## Reproduce

Run `node tools/fetch-city-maps.mjs astana almaty shymkent` from the repository root. It makes read-only public Overpass queries, retries temporary overload responses, rejects incomplete geometry, caches raw responses under ignored `.codex-private/osm-city-cache/`, and writes compressed GeoJSON plus source manifests. Remove the relevant cached response when deliberately refreshing its source date. The pinned MIT converter and license are in `tools/vendor/`.

The local server exposes the allowlisted `.geojson` URLs, serving the checked-in `.geojson.gz` bytes with gzip negotiation. Browsers decompress automatically; clients requesting identity get the same decompressed JSON. Raw/source files and arbitrary paths are not exposed.

Rendering queries a spatial index with an overscan margin and draws every intersecting feature. Building SVG paths are batched to reduce DOM nodes, without the former arbitrary 2,600-feature cap. Geometry is not simplified by this pipeline. The same colors and projections are retained.
