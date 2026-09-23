# Building and city-cue sprites

This folder contains nine decorative object types, each in top-down and tilted views. They are generic miniatures, not claims that a particular building or LRT station exists at a given map coordinate. The verified Astana geography package controls locations.

All sprites have a transparent `128 × 128` viewBox. `data-anchor-x` and `data-anchor-y` define the placement point in viewBox units: `(64,64)` for top-down icons and `(64,112)` for tilted icons. Render both views at the same CSS width, then align the selected anchor to the map point. Shadows can be placed separately beneath these transparent objects.

`build_buildings.py` regenerates the editable SVGs, compact exports in `assets/exports/world/buildings`, and `ASSET-MANIFEST-buildings.csv`. The color constants follow `assets/sources/style/style-system.md`. These source and export SVGs contain no labels, numbers, or raster images.
