# Asset source register

Review date: 2026-09-23. Stable IDs and status live in manifest.json. The approved producer exports now replace the earlier starter/placeholder art. Historical intake details below describe the older review, not current runtime readiness. This register does not certify geographic boundaries.

## generated-vector

Original project SVG artwork from the approved miniature-city package, committed in 053cba4. Producer provenance: assets/README-PACK.md, assets/ASSET-MANIFEST.csv, and the more precise family manifests under assets/sources/world and assets/sources/policies. Project-owned; redistribution license not specified by the owner. No CC0 or third-party redistribution rights are asserted. Icons, policies, terrain, buildings, effects and favicon use their exported files directly. Anchors come from the specific producer manifest rather than generic package summaries. All illustrations are decorative and never define scores or official geography.

## generated-raster

Project-directed OpenAI image generation, packaged into transparent character and vehicle PNG exports. Sources and frame semantics: assets/sources/characters/README.md, assets/exports/characters/ASSET-MANIFEST.csv and assets/sources/units/vehicles/README.md. Project-owned; redistribution license not specified. Character sheets contain four named poses, not a four-frame walk cycle. Their stills are upright figures also usable as top-view markers. Vehicle atlases contain five single-frame directions, not animation frames. Runtime selects a still/direction; pose and atlas variants remain available lazily through game/art.js.

## Runtime inventory

game/art.js registers every SVG, PNG and effect stylesheet under assets/exports (209 files). Importing the module only creates metadata; it does not request or preload images. Helpers return existing exact-case URLs, dimensions and pixel anchors. The 52 stable manifest IDs all resolve to supplied exports. Optional sheets carry frameRects, frameLabels and per-frame anchors; consumers must select a pose explicitly. Source duplicates, ZIP, PDF and source scripts are excluded. Style compositions remain illustrative references and are not official maps. The effects stylesheet is opt-in and supplied static SVGs remain usable with reduced motion.

## starter-original

Publisher/creator: Akim project; baseline 1ee0698c4e18788a30ab30bee560a8740bcd3989. Source: assets/game/README.md, measure-icons.svg, miniature-kit.svg. Created 2026-09-23; reviewed 2026-09-23. Baseline README identifies these as original project drawings with no third-party art. Retained editable SVG sources. No separate third-party license asserted.

Policy symbols M1–M14: 32×32, shared UI/marker view, center anchor. Miniature symbols: 96×96, tilted/side starter stills, ground anchors recorded in manifest. No animation frames, directional variants or top-down counterparts supplied.

## local-export-unconfirmed

Publisher/creator and reuse terms: not supplied. Existing local assets/exports/icons and assets/sources/world were present/arriving during review; originals left untouched. Reviewed copies under assets/game/reviewed remain placeholders pending owner confirmation. Exact byte hashes and original paths are in intake.json. No claim these files came from the handoff ZIP.

Icons: native 32×32 SVG with unpainted background. Tiles: top 256×256; tilted 320×218. The grass top deliberately paints the full canvas. Four tile anchors are provisional placement anchors, not visually certified against the unavailable scene.

The initially observed ecology filenames were renamed by the asset producer during intake. Final reviewed sources are indicator-E1-greenery.svg and indicator-E2-air.svg. Manifest E1 is greening; E2 is air quality, matching the engine. Intake hashes identify the exact reviewed snapshot.

## not-supplied

No reviewed export. Creator, license, dimensions, anchors and frames unknown. Missing entries have empty views; do not construct guessed paths. Composite art previews are reference-only and stay outside runtime.

## Intake and contact sheet

intake.json records the snapshot of pre-existing/arriving local material, actual byte sizes/dimensions and SHA-256. CONTACT-SHEET.html displays all registered views and missing IDs without network requests. Checkerboard is a review background, not part of the source art. No asset was generated, upscaled, sliced or background-removed in this intake. Ready policy icons are reused; placeholder and missing are intentionally different states.
