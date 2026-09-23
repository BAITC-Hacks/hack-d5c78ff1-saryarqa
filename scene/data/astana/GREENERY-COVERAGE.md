# Geographically sourced greenery

`greenery-render.geojson` contains **3,696 polygon features**, approximately
2.06 MB: **1,696 OpenStreetMap park/garden/forest/wood features** and the existing
**2,000 sampled municipal green-space polygons**. Load this file as the green
layer, retaining water polygons separately. Drop the old green sample from the
previous combined landscape collection to avoid duplicate IDs.

All 3,696 features pass the geographic adapter without rejected geometry.
There are no park shapes constructed from point anchors. The five supplied park
anchors were checked after projection and lie inside their corresponding actual
OSM park outlines:

| Park | Source geometry |
| --- | --- |
| Botanical Garden / Ботаникалық бақ | OSM way 1196402246 |
| Presidential Park / Президент саябағы | OSM way 112177946 |
| Lovers Park / Ғашықтар саябағы | OSM way 37884583 |
| Triathlon Park / Триатлон саябағы | OSM way 1363058986 |
| Zhetisu Park / Жетісу саябағы | OSM way 69232075 |

Source `leisure=park|garden` maps to renderer kind `park`, `landuse=forest` to
`forest`, and `natural=wood` to `wood`. Original names, leaf types and other
selected source tags remain available. These polygons describe mapped green
areas, not actual positions/counts of individual trees. Any tree sprites inside
them are illustrative.

The OSM snapshot timestamp is **2026-09-22T08:45:51Z**. Attribution:
**© OpenStreetMap contributors**, [ODbL 1.0](https://www.openstreetmap.org/copyright).
The raw response, exact query, retrieval time, source URLs and output SHA-256
are retained in `osm-greenery-response.json` and `greenery-source.json`.
Every OSM coordinate is retained; multipolygon members are joined only at
identical endpoints. Outer parts and inner rings are preserved.

The municipal full-city layer reports **57,030** green-space features, but its
bulk queries returned source-server errors. This delivery does **not** claim
complete municipal coverage. The retained municipal layer is explicitly its
earlier central 2,000-feature sample, whose unknown source date/reuse terms and
0.000015-degree generalization remain recorded. It is a generic green-space
class, not a named-park or individual-tree inventory.

Reproduce from the checked-in source response using Python stdlib:

```sh
python3 scene/data/astana/build_osm_greenery.py
```

Add `--fetch` to refresh the OSM response. Existing river/water data is unchanged.
