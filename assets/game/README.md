# 2.5D game assets (work in progress)

`measure-icons.svg` contains one original vector symbol for each of the 14 measures in `simulator.js` (`#M1` through `#M14`). These are reusable UI and map-marker assets; they do not encode geography or claim a physical project has been built.

`miniature-kit.svg` contains seven original warm tabletop scene pieces: `#home`, `#apartment`, `#civic`, `#tree`, `#street-light`, `#bus`, and `#park`. They are reusable decoration, not real building locations or forecasts. A map adapter should place them decoratively and avoid implying that a particular intervention built an exact number of objects.

Example: `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="/assets/game/measure-icons.svg#M4" /></svg>`. Keep a separate text label on every interactive use. Symbols inherit `currentColor` so the UI can communicate category or state without duplicating files.

The district map, terrain, indicator overlays, sound and motion assets are **not created yet**. The map must be sourced and the five-data-versus-six-real-district presentation settled first. Do not describe this directory as a complete game art kit.

Source/license register: `measure-icons.svg` and `miniature-kit.svg` were drawn specifically for this project on 2026-09-23; no third-party artwork used. Other assets must record their provenance and reuse terms here before shipping.
