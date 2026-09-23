# Laptop 2 — real Astana world

Implemented on `codex/akim-world`, integrating the shared session/server foundation
from `61a9b76` on `codex/akim-25d-game`. Contract v1 is unchanged; playback
completion includes the host's `planRevision` and `runId`.

## Result

The default map is sourced Astana geography. The original schematic world remains
an explicit `?data=fixture` regression fixture. `createScene({root, mapData,
onIntent})` mounts the atlas; the original assets/geography signature remains
available. `loadAstanaMap()` loads thirteen initial local public resources and sixteen lazy building tiles without API keys.
The main application and `scene/dev.html` both use the shared game session.

- 1,802 actual OSM major-road ways, 150 shared-road nodes, municipal river/water
  geometry, 3,696 sourced park/garden/wood/forest polygons and all 125,832 source building footprints in the working bbox.
- Six sourced district contours from Hosted/raiony, including Nura and Saraishyk.
  Their effective date remains unverified and is disclosed. Historical four-region
  geometry is never admitted as current. Saraishyk is context only, not scored.
- Seventeen landmark miniatures and five park point anchors from supplied data.
  Five landmark display anchors were checked against named OSM objects and refined;
  original coordinates, exact OSM identities, raw XML and derivation are retained.
- Search, source inspector, archive traffic overlay, top/tilted projection,
  pan/zoom, keyboard controls and a bounded mayor walk in Nura. Exact segment
  collision checks exclude footprint/water/boundary crossings.
- Shared plan editor: fourteen measures, five choices, budget, district assignment,
  validation, eight-quarter visual playback, pause/skip/replay, outcome and best.
  Scene modules never calculate scores or infer intermediate quarterly scores.
- Capped decorative traffic (36 actors), queued/construction/active policy markers,
  and feedback based on supplied positive/negative reactions. Policy marker anchors
  identify districts, not approved construction addresses.
- Hidden/calculator/reduced-motion handling; remount and destroy release animation
  frames, listeners, observer and pointer capture.

## Integration scope

The later user request explicitly required combining the real map and game.
Besides scene-owned files, minimal changes connect `game/scene-adapter.js`,
`api/capabilities.js`, and `server.js`: an atlas capability, mapData handoff and an
exact public JSON/GeoJSON allowlist. Legacy readiness remains intact. No engine,
session, contract, root app/HTML/CSS, dependency or other worker's asset changes.

Ten distinct subagents contributed camera/data acquisition, actors/landmarks,
effects/geodata, source audit, lifecycle review, geometry optimization, playback
compatibility/main integration, game panel, regression testing and final review.
Separate worktrees were used for writers; the concurrently active assets checkout
was preserved.

## Verification

`npm test`: **127 passed, 0 failed** (Node test runner; localhost binding enabled).
Includes real bundled-data HTTP loading, allowlist/security, source district gates,
Nura collision/movement, both projections, lifecycle, stale completion tokens,
engine vectors and shared session behavior.

Browser checks on the actual atlas and main app:
- sample M7/Nura + M8/Nura + M10/Nura + M12/city + M5/Saryarka costs 95;
  outcome **56.54**, delta **+3.99**, critical indicators 2 → 0;
- playback reaches the result; skip and calculator show the same result;
- Nura walk and source district selection, corrected Baiterek coordinates,
  main-app atlas loading and source links;
- desktop viewport 1440×960 and mobile viewport 390×844 (375px content width,
  no horizontal overflow); mobile editor opens without covering the map;
- no browser error/warning logs in the final checks.

Measured locally at a desktop Nura view: 36 actors, average **1.30ms** JS motion
render across 498 samples. This excludes browser layout/paint and is not a frame-rate
benchmark. Geometry render copies use a verified 0.65m simplification tolerance;
original geometry is retained. Physical touchscreen gestures were not tested.

Screenshots from the real runtime:
- `scene/fixtures/evidence/astana-real-overview.png`
- `scene/fixtures/evidence/astana-real-nura.png`
- `scene/fixtures/evidence/astana-real-mobile.png`

Earlier images in that directory are explicitly schematic fixture evidence.

## Remaining source limits

This is a sourced playable map, not a complete city census or live digital twin.
Road coverage includes the selected major classes. The complete building source coverage is not a current census; green-space remains
sampled; heights and vehicles are illustrative. Historical corridor rankings do
not describe live traffic, and unresolved endpoints are disclosed. Twelve landmark
anchors still use the supplied coordinates without an additional identity check.
The municipal service does not state effective boundary dates or reuse terms;
metadata records that uncertainty. See `scene/data/astana/INTEGRATION.md` and
`SOURCES.md`. The map uses code-native landmark art and does not require unreviewed
external asset exports.

Run `npm start`, then open `/scene/dev.html` for the map-first game or `/` for the
main application. Only the lead merges the review branch into integration.

## UI/UX refinement

After the first pushed real-map version (`0051641`), the user requested a design
pass. The frontend-design skill was installed from the official anthropics/skills
repository and read. The revised interface uses a stronger forest/river palette,
larger sentence-case typography, contextual place descriptions and optional
coordinate/source disclosure. The plan HUD has a clear remaining-budget block
and five interactive decision slots; native controls and shared session remain.

Map labels avoid overlay controls; observed HUD resizing refreshes placement.
Close views show existing OSM road names. District selection updates map outlines,
landmark picks clear stale road highlights, search is anchored to its input,
source cards stay inside the map area, Escape dismisses popovers, and the north
compass follows the selected projection. The 127-test suite and browser
plan/result checks were repeated; screenshots in evidence reflect the refined UI.

## Building coverage and overlap fixes

Replaced the centre-only building display with a complete municipal export: 125,832
features, 16 geographic tiles, 46.7 MB. Two concurrent requests load only intersecting
tiles. The viewport selector ranks visible footprint area, preserves courtyard holes,
and caps displayed detail at 2,200 desktop / 1,200 mobile features. It does not cap
data coverage. Close-up views reveal smaller buildings. Failed tile loads offer retry;
remount/destroy abort requests. All source IDs and checksums are recorded in
`scene/data/astana/BUILDING-COVERAGE.md`.

Source footprints now have filled material roofs, rounded screen-width edges, two
facade tones and soft shadows. Height and materials remain illustrative. Landmark
labels and angled street names avoid controls and landmark models; internal road
IDs are not drawn. Labels can be toggled independently. Decisions share a card per
district. Source attribution is compact and the full source card closes.

Browser evidence: `astana-station-buildings.png`, `astana-station-top.png`, and
`astana-station-mobile.png` in `scene/fixtures/evidence`. Astana-1 surrounds now
render real buildings; desktop and 375px mobile content have no horizontal overflow.

## Complete icon redesign and greenery

After the requested checkpoint push `19b0d3a`, all 17 landmark miniatures were
redrawn as detailed architectural models in both projections (maximum 95 SVG nodes
each). Interface controls, place categories and game decision slots share a new
rounded vector symbol family. Park anchors have grove miniatures and appear first
in the place list. Label avoidance now uses the actual SVG model bounds.

Greenery uses 1,696 OSM park/garden/forest/wood polygons plus 2,000 attributed
municipal patches, replacing the duplicated old green layer while retaining water.
Real contours cover the Botanical Garden, Presidential, Lovers, Zhetisu and Triathlon
parks. See `GREENERY-COVERAGE.md` for exact source identities and coverage limits.
The municipal full export of 57,030 features failed; that complete coverage is not
claimed.

Viewport-selected green fills preserve holes and overlapping source areas. Up to
450 decorative trees (220 mobile) are sampled only within these polygons, clear of
source water, buildings and mapped roads. Crowns have a 2.6px legibility floor and
remain inside the source area with their shadows. Tree species, sizes and positions
are illustrative rather than a planting inventory. The Зелень control toggles fills
and trees together. Boundary and polygon indexes keep selection off the animation
loop; a maximum of 15 material paths draws the canopy layer.

Final browser checks: desktop Botanical Garden and landmarks, 375px mobile content
with no horizontal overflow, working greenery/label toggles, shared sample plan
result 56.54 (+3.99), and no console error/warning logs. Evidence includes
`astana-landmark-models.png`, `astana-botanical-greenery.png`, and
`astana-greenery-mobile.png`. Full Node suite: 127/127.
