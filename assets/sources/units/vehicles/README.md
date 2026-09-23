# Moving vehicle sprites

Four user-approved vehicle designs are supplied as transparent PNGs: bus, car, LRT, and municipal service van. The `*-pair.png` files are editable raster masters created with OpenAI imagegen from the approved `assets/previews/agent-06-vehicles-v2.png` concept. Run `build-vehicles.ps1` from PowerShell to rebuild the exports.

## Game integration

- Each vehicle has a `1280 × 256` transparent atlas at `assets/exports/units/vehicles/<vehicle>/atlas.png`.
- The atlas has five fixed `256 × 256` cells from left to right: `top/down`, `top/left`, `top/up`, `top/right`, `tilted/forward`.
- Every cell is a **single still frame** (`frame-01.png`). Move units by changing their map position; the art itself does not cycle. This same frame is the reduced-motion still.
- Individual frames are also exported under `<vehicle>/<view>/<direction>/frame-01.png`.
- The top-down front points in the named direction. The tilted front points toward the lower left. A reverse tilted direction can be mirrored in the game if desired, but this source does not claim a second hand-drawn view.
- Top-down anchor: `(128, 128)` in cell pixels, normalized `(0.5, 0.5)`.
- Tilted anchor: `(128, 240)` in cell pixels, normalized `(0.5, 0.9375)`. Align this point with the route/map coordinate.
- Frame order is `01` only for each direction. The atlas order is fixed as listed above.
- No labels or outcomes are baked into these images.

The generated source art is project-owned; redistribution license is not specified. Resolve any external publication license separately.
