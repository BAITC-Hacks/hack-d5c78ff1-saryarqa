# Game asset integration

The runtime uses the supplied miniature-city package in `assets/exports/` directly. `manifest.json` maps all 52 required stable IDs to reviewed exports; `game/art.js` registers all 209 export files with their real dimensions, anchors and pose/direction metadata. Registration is lazy: the app requests only images used by the current UI or scene.

The exported artwork includes 14 policy icons, 14 district markers, 14 miniature policy objects, five category icons, ten indicator icons, HUD/map symbols, six characters, four vehicle types, paired world/building views, static effects and favicon sizes. The atlas uses the original citizen, maintenance, emergency, mayor and vehicle PNGs; policy illustrations and interface symbols reuse the corresponding original SVGs.

`scene/map-life.js` prepares up to 1,800 short illustrative walking paths beside mapped roads and inside parks. Buildings, water and district borders constrain these paths. A reusable pool renders at most 320 citizens on desktop and 140 on small screens, further reduced by viewport area, screen spacing and UI/landmark exclusions. Citizen artwork is 8-18 CSS pixels high; the mayor is 28 pixels. Reduced motion freezes movement and preserves the supplied stills. These figures are a visual sample, not the population of Astana, district census counts, live pedestrian locations or measured traffic.

Paired world tiles remain decorative. They do not replace sourced river, road, district or building geometry. The five style exports are design references and are not loaded as geographic backgrounds. Source sheets, ZIP archives, contact sheets, unneeded pose sheets and alternate directions are preserved without eager loading. Sound exports were not supplied. The geographic effective date remains unverified; see the separate geography documentation.

`SOURCES.md`, the producer `assets/ASSET-MANIFEST.csv`, and family manifests document provenance. Artwork is project-owned; the owner has not specified a redistribution license. Generated artwork is not labeled CC0. Earlier starter SVGs and historical intake records remain for provenance; runtime stable IDs now point to approved exports.

Run `node tools/check-assets.mjs` and `node --test tests/art.test.js tests/assets.test.js tests/map-life.test.js` to validate filenames, dimensions, anchors, local SVG safety, complete inventory, route constraints and responsive actor limits. Browser layout and imagery require a separate rendered check.
