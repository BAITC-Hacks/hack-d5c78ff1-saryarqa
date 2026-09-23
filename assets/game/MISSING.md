# Asset handoff status

Reviewed 2026-09-23 against the approved producer package committed in 053cba4.

## Available artwork

All **52 stable scene IDs** now resolve to supplied ready exports. `game/art.js` registers all **209 SVG, PNG and stylesheet exports** lazily: six characters with stills and named poses, four directional vehicles, paired world/building/terrain/furniture/road objects, 14 policy icon/object/marker sets, UI icons, effects, favicon and illustrative style references. ZIP, PDF, source scripts and duplicate masters are not runtime dependencies.

Character sheets contain named poses, not a complete walk animation. Vehicles contain directional stills; map movement supplies motion. Upright character sprites may be markers in top view and do not claim a true roof view. The renderer must keep static alternatives available for reduced motion. Provenance and the unspecified redistribution license are recorded in SOURCES.md.

## Remaining geographic limitations

The six sourced district polygons remain an **unverified review candidate**. Boundary date/reuse terms and differences from official district areas remain unresolved. Real road, river, bridge and LRT layers must retain their own source and review status; artwork does not certify their geographic placement. Do not relabel illustrative style compositions or sampled routes as official geometry.

District population, full bus fleet and LRT measured ridership remain subject to the city-context evidence and null values. Art availability does not authorize fabricated density or simulation values.

## Rendered acceptance

The registry and manifest validate exact-case paths, dimensions and metadata. Final map composition, controls, sprite direction, visual anchor alignment, accessibility, responsiveness and performance must be checked in the integrated renderer. Availability of exports alone is not browser acceptance.
