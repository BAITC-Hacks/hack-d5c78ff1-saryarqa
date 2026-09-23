# Shared interfaces v1

Status: v1 implementation contract. The session, preview, presentation, storage and adapter are implemented on `codex/akim-session`; scene/assets/data readiness is tracked separately. Laptop 1 owns changes to this document and announces interface changes before another owner depends on them. Do not quietly invent different event names or formats in each branch.

## Ownership boundary

`app.js` connects one session to Calculator and Scene. Session owns decisions/results. Engine owns mathematics. Scene owns navigation/rendering/actors. Asset/data files describe visuals/geography/context. Server serves the explicit public files. No scene or asset file mutates the engine or stores a second authoritative plan.

## District identity

| regionId | Label | simulationDistrict |
|---|---|---|
| `esil` | Есиль | `Есиль` |
| `almaty` | Алматы | `Алматы` |
| `saryarka` | Сарыарка | `Сарыарка` |
| `baikonur` | Байконур | `Байконур` |
| `nura` | Нура | `Нура` |
| `saraishyk` | Сарайшық | `null` |

Display spelling/aliases may differ in source data. Map them explicitly to these IDs; never join by fuzzy name matching at runtime. Plan entries remain the existing engine shape `{ id: 'M7', district: 'Нура' }`; city entries use `district: null`. Measures are M1 through M14, not M01. The sixth region can be focused but cannot be assigned to a measure. Citywide scenario effects still target exactly five model districts.

## Session owned by Laptop 1

```js
const session = createGameSession({ storage });
session.getSnapshot();
const unsubscribe = session.subscribe((snapshot) => {});
session.dispatch({ type: 'ADD_MEASURE', id: 'M7', district: 'Нура' });
session.destroy();
```

Snapshots are read-only copies or frozen objects. `subscribe` immediately provides the current snapshot, then updates; returns an unsubscribe function. `destroy` releases subscribers and outstanding work. Storage is injected and may be unavailable.

Required snapshot fields:

```js
{
  contractVersion: 1,
  revision: 0,          // increments on observable session updates
  planRevision: 0,      // increments only on plan edits/reset/load
  mode: 'game',        // 'game' | 'calculator'
  projection: 'top',   // 'top' | 'tilted'
  view: 'overview',    // 'overview' | 'district'
  focusedRegion: null, // regionId | null; independent of assignment
  plan: [],            // insertion order; entries use engine names
  validation: {},      // exact validatePlan output
  preview: { measures: [], issues: [], score: null },
  result: null,        // null or successful calculatePlan output
  presentation: null, // null or metadata described below
  playback: { status: 'idle', speed: 1, runId: 0 }, // idle/playing/paused/complete; runId increments for each new playback
  personalBest: null  // null or { plan, score, rulesVersion }
}
```

Actions:

| Type | Payload | Effect |
|---|---|---|
| `ADD_MEASURE` | id, district (name/null) | Add a unique draft decision; validate, clear old outcome. |
| `REMOVE_MEASURE` | id | Remove a decision and its preview. |
| `ASSIGN_MEASURE` | id, district | Change district; citywide entries stay null. |
| `LOAD_PLAN` | plan | Validate structural shape; enter editable draft, do not trust stored result. |
| `FOCUS_REGION` | regionId/null | Inspect only, including Saraishyk; does not change policies. |
| `SET_MODE` | mode | Change interaction surface while preserving plan/result. |
| `SET_PROJECTION` | projection | Change camera style; no scoring effect. |
| `SET_VIEW` | view | Overview/close-up; requires focus for close-up. |
| `FINALIZE` | none | Score through engine only if valid; save personal best and create replay metadata. |
| `RESET` | none | Clear draft/outcome, retain personal best unless separately requested. |
| `PLAYBACK_CONTROL` | command, optional speed | command is play/pause/skip/replay/speed; changes only visual playback. Speed must be positive and bounded. |
| `PLAYBACK_COMPLETE` | planRevision, runId | Scene echoes BOTH current tokens; reject missing/stale tokens. No recalculation. |

Unknown actions are rejected explicitly. Invalid user selections never get a score; draft errors may remain visible for correction. An attempted sixth/duplicate decision must be refused without hidden replacement. Adding a district measure without a target can remain an incomplete draft; it is never automatically assigned to an unrelated focused region.

Every plan edit nulls `result`/`presentation` and invalidates obsolete AI/animation work via planRevision. Mode, projection, focus and playback controls must not erase a plan or change its numerical outcome.

The engine exports `RULES_VERSION = 'hackalem-v1'`. Increment it whenever scenario constants/math change. Personal-best records use that constant, reject incompatible versions and recompute valid stored plans.

Only `nura` initially supports `view: 'district'`. For another focused region, stay in overview and show its inspector plus a brief detailed-scene-unavailable message. All five scored regions remain playable there. The scene owns an illustrative walkable mask in `scene/world.js`, contained inside the chosen district polygon, with buildings/water excluded where represented. It is a game navigation area, not a surveyed pedestrian network; no extra geography-file field is required.

FINALIZE computes/stores a valid outcome once. In Game it sets playback to playing; in Calculator to complete. During Game playback, hide new numeric final-score/personal-best values until completion or skip, so the reveal remains meaningful. Saved best may already be updated safely; its new numeric announcement waits for reveal. `PLAYBACK_COMPLETE`/skip sets complete. Entering Calculator also completes playback and reveals the same result; returning to Game does not start it again automatically. Replay explicitly resets scene progress but never writes another result, reruns AI or changes best. Plan edits set playback idle. Pause/play/speed/skip controls dispatch through the session; Scene consumes snapshot.playback and reports completion once for the matching revision. Reduced motion completes immediately through the same event.

## Preview and replay

`game/preview.js` returns `measures` entries with `id`, `scope`, `targets`, `cost`, `lag`, `factor`, and lag-adjusted `effects` by indicator ID. Missing targets produce issues; no fabricated target. Use engine constants/shared pure helpers. Draft preview has `score: null`. Any synergy information is explicitly separate; score contribution cannot be obtained by adding policy effects because the final formula is nonlinear.

`game/presentation.js` consumes a confirmed result plus draft insertion order and emits:

```js
{
  planRevision: 1,
  horizon: 8,
  order: ['M7', 'M8', 'M10', 'M12', 'M5'],
  cues: [], // {measureId, regionIds, lag, effects}; fields derived from result
  reactions: [] // {regionId, indicator, delta, tone:'positive'|'negative'|'neutral'}
}
```

Keep timing separate from score. Timeline progress may be local to the scene; pause/speed/skip change only presentation. Lag affects visual scheduling, but the official data does not define intermediate scores or full quarterly indicator values. Show exact final numbers from `result` at completion (or immediately in Calculator). Skipping cannot award another run/best or rerun AI. Plan edits cancel the old replay. Reactions follow computed indicator deltas; mixed outcomes must not be represented as universally positive.

## Scene owned by Laptop 2

```js
const scene = createScene({ root, assets, geography, onIntent });
scene.update({ snapshot, context });
scene.destroy();
```

`createScene` is synchronous after the lead loads/validates manifest+geometry; imports from `scene/index.js`. `update` is idempotent and must not install duplicate loops/listeners. `onIntent` emits FOCUS_REGION, SET_VIEW, SET_PROJECTION and PLAYBACK_COMPLETE tagged with BOTH `snapshot.planRevision` and `snapshot.playback.runId`; shell playback controls dispatch PLAYBACK_CONTROL. Missing or old tokens are rejected, including completion from a previous replay of the same plan. The shell opens the corresponding inspector/policy UI. Policy selection dispatch stays with the lead shell. Camera pan/zoom and mayor location stay internal to Scene. The scene does not import the store singleton or engine calculation function.

`context` is `{ cityData, reducedMotion, visible }`: cityData is the validated data/city/context.json object, reducedMotion is a boolean, visible is false in Calculator/hidden documents. Renderer caps are documented configuration owned by Laptop 2. The lead updates visibility/motion changes; the scene pauses work while invisible and performs deterministic completion under reduced motion. These controls do not alter the score.

Scene CSS is prefixed `.akim-scene`; no global resets or generic button/body rules. Destroy releases timers, observers, animation frames and listeners. Hidden/Calculator/reduced-motion behavior is explicit. A failed optional sprite uses a labeled fallback and reports its ID; failed geography cannot be passed off as accurate Astana.

## Geometry owned by Laptop 3

`data/geography/astana.json`:

```js
{
  schemaVersion: 1,
  id: 'astana',
  status: 'verified', // or 'unverified'/'fixture'; never promote automatically
  viewBox: [0, 0, 1000, 1000], // EXAMPLE format, actual export defines dimensions
  projection: { sourceCrs: '...', method: '...', parameters: {} },
  boundaryDate: 'YYYY-MM-DD',
  sources: [],
  regions: [
    { regionId: 'nura', label: 'Нура', simulationDistrict: 'Нура',
      polygons: [], labelAnchor: [0, 0], sourceIds: [] }
  ],
  paths: [] // {id, kind, points, sourceIds, illustrative:boolean}
}
```

Above numbers/ellipses are schema examples, not valid city data. Production must include all six regions. `polygons` is an array of polygons; each polygon is an array of rings; each ring is closed [x,y] points. First ring is outer; remaining rings are holes. All coordinates and path anchors share one planar world space in the specified viewBox. Preserve source GeoJSON/WGS84 separately if supplied; document projection/normalization, maintain aspect ratio, and handle all multipolygon parts/holes. Do not scale each district independently. Label anchors must be inside the relevant region.

The renderer owns camera projection only. Source roads/routes need verified alignment. Illustrative paths for decorative walking/traffic remain distinguishable from real transport routes in metadata and user claims. Stable region IDs are mandatory even while geometry is a development fixture.

## Real context owned by Laptop 3, reviewed by lead

`data/city/context.json` contains `schemaVersion: 1`, `sources: []`, and `observations: []`. Each observation has:

```js
{ id, metric, regionId, value, unit, asOf, sourceId, definition, status, note }
```

`regionId` may be one of six IDs or `city`; `value` is a finite nonnegative count or null; `status` is verified/unavailable/unverified. `asOf` is ISO date/period with precision identified in note. Missing data is null with a reason. Verified observations require a retrievable source, metric definition and compatible geography/date. Population, fleet stock, daily active buses, route count and ridership are different metrics.

Sources record publisher, URL, reference/publication date where known, retrieval date, location in document and reuse/attribution terms. Do not include personal records. Do not derive district counts from scenario population weights. If district counts are unavailable, display the available city total at city scope; do not create allocation estimates silently.

A renderer cap/sample mapping must be documented in the world report: metric used, scope/date, density function, cap, and source-data fallback. Sprites are illustrative samples. Score-induced behavior changes do not rewrite source observations or imply a measured future count.

## Asset manifest owned by Laptop 3

`assets/game/manifest.json` has `schemaVersion: 1`, `assets: []`. Entries have unique `id`, `kind`, `status` (ready/placeholder/missing), `views`, `sourceId`. Source register resides in `assets/game/SOURCES.md`.

Each view has `path` relative to the repo root, optional `symbolId` for SVG sprite use, `width`, `height`, `anchor: [x,y]` in pixels, and optional `frames`/`fps`/`directions`. `views` uses `top`, `tilted`, or `shared`. JSON paths use forward slashes, exact filename case, no absolute paths or parent traversal. Missing views are explicit, not guessed by the renderer.

Stable IDs: `measure.M1` through `measure.M14`; `category.transport`, `category.ecology`, `category.social`, `category.safety`, `category.services`; `indicator.T1` through the ten existing engine indicators; `unit.mayor`, `unit.citizen.01`, `unit.citizen.02`, `unit.citizen.03`, `unit.worker`, `unit.emergency`, `vehicle.car`, `vehicle.bus`, `vehicle.lrt`, `vehicle.service`; `building.home`, `building.apartment`, `building.civic`, `building.school`, `building.clinic`; `terrain.tree`, `terrain.park`, `road.straight`, `road.corner`, `road.junction`, `road.crosswalk`; further IDs documented in manifest. Existing SVG symbols M1–M14 and home/apartment/civic/tree/street-light/bus/park can map directly.

Only make separate icons/world sprites where they serve a visible function; no need to fill arbitrary quotas with incompatible art. Refer to 07-ASSET-PACK for the complete collection brief.

## Change requests

Before changing an interface, post: contract version, proposed diff, producer/consumer owners, migration/compatibility plan and affected tests. Lead accepts/rejects and records the new version. Until accepted, keep v1 and work on independent tasks. A feature PR that breaks a consumer cannot merge just because its own isolated tests pass.
