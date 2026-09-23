# Six-district geography review candidate

`astana.json` follows shared contract v1, with **status `unverified`**. It contains six sourced regions, 10 exterior polygons and 1,778 vertices. Сарайшық is inspectable and explicitly unscored. No route, river, road or bridge geometry is supplied (`paths: []`).

Source: [GIS esaulet.kz / Hosted/raiony / layer 0](https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0), retrieved 2026-09-23. Full query: `query?where=1%3D1&outFields=objectid%2Cname_object%2Cname_object_kaz&returnGeometry=true&f=pjson`. Retained files are Esri JSON, not GeoJSON: local projected coordinates cannot honestly be labelled WGS84. No personal attributes were requested.

The source does not establish its administrative boundary date, a publication date or reuse license. The copyright field is empty; that is not a license. `boundaryDate: null` records the unknown explicitly. Confirm date/rights and obtain lead/world-owner review before promotion or shipping.

## Reproduction and projection

Run `node data/geography/export.mjs` from the repository. It reads the two retained source files and writes `astana.json` plus `review.svg`. No network call, independent district scaling, camera tilt, simplification or hand-drawn boundary is used. Source coordinates in the local `Astana` WKT CRS are normalized by one common scale, with 40 units of padding, into `[0,0,1000,1000]`. Source grid +Y becomes world −Y. The local CRS has an azimuth parameter; true north has **not** been calculated. The viewBox has intentional spare horizontal space to preserve aspect ratio.

The converter uses actual feature bounds. Layer metadata extent is stale relative to 45 vertices in Baikonur, Almaty and Esil; clipping to that extent would lose source geography. Disjoint parts are preserved: Saryarka 1, Baikonur 3, Nura 1, Almaty 2, Saraishyk 1, Esil 2. The dataset has no holes. The containment routine must be re-reviewed for a replacement dataset with touching/nested rings; this intake does not claim a general GIS repair library.

Labels are selected from interior candidates using maximum tested edge clearance, then checked against all polygon parts/holes. All six anchors are inside their own region. Coordinates are rounded to six decimal places; measured planar area change from rounding was below 0.000022 hectares per district.

## Source comparison — not accepted boundary accuracy

The [official boundary announcement](https://www.gov.kz/memleket/entities/astana-saulet/press/news/details/1274528), retrieved 2026-09-23, lists revised district areas. Its effective/publication date was not exposed in retrieved content. The comparison below uses planar source area, not geodesic surveyed area.

| Region | Source ha | Announcement ha | Difference |
| --- | ---: | ---: | ---: |
| Saryarka | 6,770.836 | 7,144 | −5.223% |
| Baikonur | 18,294.534 | 18,190 | +0.575% |
| Nura | 18,896.539 | 18,516 | +2.055% |
| Almaty | 8,485.485 | 8,412 | +0.874% |
| Saraishyk | 6,986.050 | 6,953 | +0.475% |
| Esil | 20,555.419 | 20,518 | +0.182% |
| Total | 79,988.864 | 79,733 | +0.321% |

These differences block claiming current accurate administrative geography. Do not rescale districts to force agreement. Read-only review found no strict ring self-crossings, but four cross-district segment crossings already exist around nearly coincident source endpoints at submillimetre precision (layer XY tolerance 0.001 m). No automatic snapping was performed; a topology-perfect partition is not asserted.

Independent visual reference: [Astana planning PDF, page 4 / ГП-5.1](https://www.gov.kz/uploads/2025/12/29/7902097b2dbd6bc3e3f7375c35ea7781_original.9856233.pdf), a 2025 map/chart. It is a reference lead, not a georeferenced substitute or proof this undated dataset uses matching borders. Population chart text extraction was not used to populate district counts.

`review.svg` / `review.png` show the actual exported coordinates for inspection. A legible screenshot and schema pass do not establish administrative accuracy. The scene must preserve the unverified warning and use the same coordinates for both views.

## Retained source integrity

SHA-256 of `sources/esaulet-districts.esri.json`: `28cd039c8505f9570739c68463f00985a9582e90812182b8f785ff38fc18253b`.

SHA-256 of `sources/esaulet-layer.json`: `38d4f4d7bd7fc504e4f33ab1bc8610ebefc49b29a4668a74ddb8d4c46562e689`.
