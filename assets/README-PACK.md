# Saryarqa City Game — asset package

This ZIP contains editable source assets, compact game exports, approved concept previews, a contact sheet, and a file-level source/license manifest for the 2D/2.5D Astana city-management game. It does not contain the website or application code.

## Approved direction

Warm miniature city with saturated, simple silhouettes. Views from above and tilted 2.5D use one visual system. Decorative placement does not change the district-level simulation. Artwork contains no scores or numeric outcomes.

## Folders

- `sources/`: editable SVG files, raster source sheets, build scripts, and local notes.
- `exports/`: game-ready SVG and transparent PNG assets.
- `previews/`: approved concept contact sheets plus the geographic source-status sheet.
- `ASSET-MANIFEST.csv`: each image and effect export, its dimensions, anchor, creator/source, license status, and review status.
- `CONTACT-SHEET.pdf`: visual index of the package.
- `MISSING.md`: geographic layers that could not be verified for an accurate, reusable 2026 map.
- `PROMPTS.md`: prompt briefs used for generated raster concepts and sprites.

The `sources/style/` scenes are **illustrative layouts**, not the real Astana city outline. The publicly available district geometry checked for this package disagreed with the official 2026 district areas. The package therefore does not claim to provide a finished interactive geography. See `sources/map/RESEARCH-REPORT.md` and `MISSING.md`.

## Use in a web game

Use SVG exports for HUD, markers, world objects, and effects. Character and vehicle PNG sheets have transparent backgrounds; their accompanying READMEs document frame order and anchors. Keep labels and scores in the application UI. Render the static effect and still sprite when reduced motion is requested.

## Rights and attribution

The included visual artwork was created for this project from the approved concepts and contains no third-party image assets. The project owner has not specified a redistribution license for it. Geographic reference facts are attributed in `sources/map/RESEARCH-REPORT.md`. No official GIS or OpenStreetMap boundary vectors are redistributed in the ZIP.
