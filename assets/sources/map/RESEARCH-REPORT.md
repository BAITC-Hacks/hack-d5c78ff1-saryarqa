# Astana geographic package — source audit

Research date: 2026-09-23. Status: **reference only; no releasable 2026 district polygons**. Both the public city GIS layer and the checked OpenStreetMap relations fail the current-boundary validation.

## Current administrative baseline

The Astana Architecture, Urban Planning and Land Relations Department reports the following district areas after the 14 August 2026 boundary decisions. Their sum is 79,733 ha, matching the reported city area.

| District | Official 2026 area, ha | Public GIS layer area, ha | GIS minus official, ha |
|---|---:|---:|---:|
| Алматы | 8,412 | 8,485.49 | +73.49 |
| Байқоңыр | 18,190 | 18,294.53 | +104.53 |
| Есиль | 20,518 | 20,555.42 | +37.42 |
| Нұра | 18,516 | 18,896.54 | +380.54 |
| Сарыарка | 7,144 | 6,770.84 | -373.16 |
| Сарайшық | 6,953 | 6,986.05 | +33.05 |
| **Total** | **79,733** | **79,988.86** | **+255.86** |

The GIS figures above were supplied by the coordinating agent from the public FeatureServer's `SHAPE__Area` field (square metres, divided by 10,000). I did not independently extract or redistribute its geometry. Area discrepancies may also reflect different geometry treatment or layer metadata. They are large enough that this layer cannot be certified as the current 2026 boundaries.

Primary sources:

- City department announcement and all six 2026 areas: https://www.gov.kz/memleket/entities/astana-saulet/press/news/details/1274528
- Decision 510-2879 / 460/58-VIII on Saryarka and Baiqonyr: https://old.adilet.zan.kz/kaz/docs/G26ABW52879
- Decision 510-2880 / 459/58-VIII amending the other district acts: https://adilet.zan.kz/rus/docs/G26ABW51028
- City-run GIS portal announced by the department: https://www.gov.kz/memleket/entities/astana-saulet/press/news/details/324850?lang=ru
- Public six-district polygon service: https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0
- 2025 AstanaGenPlan administrative reference, predating the 2026 changes: https://www.gov.kz/uploads/2025/12/29/28d1a632f23ee3e9f8c7e5c949910735_original.10102332.pdf (PDF page 6, GP-2.3)

## Source and reuse assessment

The city GIS `raiony` service has all six names in one polygon layer and uses a local projected CRS called `Astana`, based on WGS 84, centred at 71.42142501666659° E, 51.16971010555549° N. Its `Copyright Text` and description fields are blank. Public viewing and querying do not establish permission to distribute derived vectors in a game asset ZIP. The layer also has no visible revision date. Treat it as a reference, not a final asset source.

OpenStreetMap is a potential source for waterways, existing roads, bridges and railway. OSM data is available under ODbL with attribution and share-alike obligations: https://www.openstreetmap.org/copyright . Direct use of the OSM Foundation's tile service must also follow https://operations.osmfoundation.org/policies/tiles/ ; the asset ZIP should contain extracted vectors rather than bulk-downloaded tiles.

### OpenStreetMap district check

The coordinating agent queried Nominatim for named Astana administrative relations with GeoJSON geometry. The read-only results and area calculation are in `data/osm-research/` outside the asset package. The analyzer uses a local equirectangular approximation centred on 51.17° N, so the figures below are approximate. Each result was selected by its `display_name` ending in Astana, not by district name alone: other Kazakh regions have districts with the same names.

| District | OSM relation ID | OSM area, approx. ha | Official 2026 area, ha | Difference, approx. ha |
|---|---:|---:|---:|---:|
| Алматы | 3482819 | 9,321 | 8,412 | +909 |
| Байқоңыр | 8593081 | 18,350 | 18,190 | +160 |
| Есиль | 3479876 | 39,271 | 20,518 | +18,753 |
| Нұра | 20593940 | 18,803 | 18,516 | +287 |
| Сарыарка | 3486954 | 6,777 | 7,144 | -367 |
| Сарайшық | 19733918 | 6,126 | 6,953 | -827 |

These discrepancies exceed any plausible effect of the approximate area calculation, especially for Есиль. The OSM set is therefore **rejected for final 2026 district boundaries**. Its legal reuse under ODbL does not make its geometry current. Do not copy these GeoJSONs into the asset package, derive the city outline from them, or label a preview built from them as verified. An earlier Overpass attempt did not produce a verifiable result; the later Nominatim research is the basis for this rejection.

Another publicly documented candidate is the Kazakhstan National Spatial Data Infrastructure WMS district layer `map.gov.kz / geonode:border_districts`. Its public [layer passport](https://qazaqstan.space/data/qazgeo/district_boundaries) says the update is unconfirmed, access is display-only through remote WMS, and no reuse license is specified. It therefore does not currently solve the editable-vector requirement.

## Release method once a suitable source is found

1. Obtain a single current six-district vector dataset with explicit redistribution rights. The checked OSM relations have failed area validation; they would need substantive corrections and a fresh topology check before reconsideration. Record feature IDs, extraction date, and license.
2. Preserve the original data and CRS. Reproject to EPSG:4326 for GeoJSON, then to one shared planar map coordinate system for SVG. Derive the city outline from the union of the same six polygons, including any detached city territories.
3. Run geometry validity, pairwise overlap, and uncovered-area checks. Derive six masks from the same master geometry; do not manually redraw or independently simplify shared edges.
4. Compare each polygon area to the official 2026 area and inspect each discrepancy against the decisions and authoritative reference. If unresolved, mark the affected layer unverified.
5. Add Есиль, major roads and bridges as separate attributed OSM-derived layers only after verifying feature tags and positions. Separate existing routes from planned LRT and other proposals.
6. Export top-down SVG/GeoJSON and derive the tilted preview from exactly the same geometry. Keep labels dynamic in the app.

This report is a source audit, not proof of geographic accuracy for any exported vector.
