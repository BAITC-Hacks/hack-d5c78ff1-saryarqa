# Style system — «Аким на 5 часов»

Status: approved direction based on `assets/previews/agent-01-style-v2.png`. The two scenes here are **fictional style samples**, not maps of Astana. City and district borders must come from the separate verified geographic map package. Never use these scene paths as geographic data.

## Visual language

Warm miniature city with saturated, limited colors and bold silhouettes. Objects use two or three color planes, square or gently rounded edges, and few interior marks. Text, district names, numerical scores, and policy outcomes are rendered by the app, never baked into world imagery. Character and icon silhouettes must read at 24–32 px.

## Palette

| Role | Hex | Use |
| --- | --- | --- |
| UI paper / highlight | `#FFF8EA` | Background, sparse bright accents |
| Land | `#A5CF59` | Base land plane |
| Land shade | `#78B74B` | Terrain edge or quiet variation |
| Grass / ecology | `#70C44D` | Green space and ecology category |
| Trees | `#1D8E63` | Canopies; `#49B36C` for one highlight |
| River | `#28B9DD` | Water, with `#159BC4` edge |
| Road | `#4A5D67` | Carriageway; `#344D5B` deep edge |
| Walkway / plaza | `#F7DEAA` | Pedestrian ground |
| Buildings | `#F5B64D` | Main warm mass; `#DC893A` shaded face |
| Bus lane / active vehicle | `#E66C4C` | Transit emphasis in world scene |
| Transport category | `#00AEB6` | Consistent with existing category icon |
| Social services category | `#FF9B39` | Consistent with existing category icon |
| Safety category | `#278DD2` | Consistent with existing category icon |
| City services category | `#8C75C8` | Distinct from the other four categories |
| Positive | `#2AA779` | Improvement; add icon or + shape |
| Negative | `#D95C58` | Trade-off; add icon or − shape |
| Neutral | `#89999A` | No change |
| Selected district | `#F2CA55` | Selection outline and soft fill |
| Unscored district | `#B8B8AD` | Muted fill and dashed outline; never imply score 0 |
| Ink / dark stroke | `#173247` | UI icon outline and accessible foreground |

Category and state distinctions must use shape, outline, or labels as well as color. `palette.svg` is the editable swatch sheet.

## Scale and camera

- Reference ground tile: `256 × 256` logical units in top view, consistent with the starter world tiles. The concept scenes use a `640 × 480` fictional layout.
- The tilted ground uses the same scene paths through `matrix(.9 .25 -.35 .5 190 27)`. Building footprints and trees use the same coordinates, with vertical faces added above the transformed footprints. This is an art projection, not a GIS transformation.
- A tree canopy is about 36–44 top-view units across. A bus is about 48 × 16 units. A small building footprint is about 50 × 65; civic building about 120 × 70. At normal zoom, avoid drawing façade detail smaller than 3 screen pixels.
- Use one shadow direction: lower right. Main light comes from upper left. Shadow offset is roughly 5–8 top-view units or 4–7 screen pixels at reference scale, in `#173247` at 12–20% opacity.
- Top-view road edges are 4–5 units; lane dashes are 2.5 units. Tilted roof edges are 1.5–2 units. UI icons retain existing 2.4 px dark outlines at a 32 px viewBox. Keep detail strokes above 1.5 px at final render size.
- Buildings have one lit top plane, one warm front plane, and one darker side plane. Trees have one main canopy circle and at most one highlight. No photographic texture, repeated tiny windows, or elaborate roof trim.

## Motion

- District hover: 160 ms ease-out outline/opacity change.
- Selection: 220 ms ease-out scale or outline transition; keep district geometry stationary.
- Policy placement: one 400 ms soft pulse, no perpetual animation.
- Improvement and trade-off effects: 250–450 ms opacity/translation, with a static final state. Do not suggest that the animation itself alters the score.
- In `prefers-reduced-motion: reduce`, skip motion and show the static selection/effect frames immediately.
- Keep animation to transform and opacity where practical, avoiding per-frame SVG geometry edits.

## Files and reconstruction

`build-style.mjs` contains the single fictional geometry definition and writes the editable SVG scenes and PNG preview. `scene-top.svg` and `scene-tilted.svg` are separate, editable assets. `preview-style.svg` and `preview-style.png` combine them for review. Runtime map rendering must use the verified geography package, then apply these visual rules to that geometry.
