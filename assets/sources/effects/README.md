# Map reactions

The 17 exported SVGs are static, transparent, 64×64 assets. They contain no text, score, or invented city geometry. Use them as markers or HUD overlays at about 24–64 CSS pixels. Apply `effects.css` to the application's real district paths and overlay elements.

District states use these classes on the rendered real boundary path: `effect-district-hover`, `effect-district-selected`, and `effect-district-unscored`. The unscored treatment is gray with a dashed border so it remains distinct without relying only on color. The outline classes use `vector-effect: non-scaling-stroke` to stay readable while zooming.

Add the optional animation classes to the matching overlay: `effect-placement-pulse`, `effect-connection-path`, `effect-positive`, `effect-negative`, `effect-critical`, `effect-cheer`, `effect-finish`. Each runs at most twice. Static SVGs are always present, and the CSS disables movement under `prefers-reduced-motion: reduce`.

The graphics indicate a type of change or reaction. The app must calculate and render the actual district outcome separately. Do not imply that placing a decorative marker changes a score by itself.

To rebuild exports from editable source, run `node assets/sources/effects/generate-effects.mjs` from the project root. The generator writes the SVG source files and identical game exports, and refreshes the local manifest. All artwork in this folder is original project work; the project owner has not specified a redistribution license.
