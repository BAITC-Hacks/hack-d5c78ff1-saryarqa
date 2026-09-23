# Gameplay fixes — isolated handoff, 2026-09-23

Branch: `codex/akim-world-gameplay-fixes`. No merge into integration/main. No edits to the other owners' map, assets or visual styles.

## Synchronization

Started from world `b21a7e8` and merged shared integration `61a9b768`. While this task ran, another world agent published the atlas implementation through `0051641`. These histories are now intentionally separate: the coordinator was notified and owns combined review. **Do not replace the newer `scene/index.js` wholesale:** preserve its atlas dispatch. The two sides also have separate runId fixes; reconcile behavior/tests rather than blindly duplicating them.

Worker commits, integrated serially in independent worktrees:

- `f42d787`: effects completion carries captured planRevision + runId, same-plan playing-to-playing replay resets, stale updates ignored. May overlap remote playback compatibility commit `0ec91be`.
- `79e5ea7`: actor movement/collision/caps/unknown-data regression tests. No actor implementation changes were needed.
- Coordinator-owned changes in this branch: stable scene district buttons; inspector focus/open-details preservation; hidden/blur/pointer-cancel input guards; persistent keyed actor SVG nodes; shared-session development harness; browser acceptance script.

## Why the runtime fixes matter

Rebuilding district buttons on every session update lost keyboard focus. Input handlers previously accepted actions when scene visibility was false. Recreating sprite nodes every frame prevented the browser from reaching network idle; actor nodes now retain their identity and only their positions change. Failed or changed asset views still rebuild deliberately.

The scene development harness now uses the actual `createGameSession` and deterministic engine, not invented successful fixture results. A two-measure draft remains unscored. The play action loads the organizer's valid sample; complete/skip/reduced-motion outcomes remain `56.54307`.

## Verification

- `npm test`: 69/69 passed; no skips. Includes actor collisions/bounds, caps, stale saves, session parity, effects/replay, camera transforms and server checks.
- `node --check scene/index.js`, `node --check scene/dev.js`, `node --check tests/scene-browser.mjs`, `git diff --check`: passed.
- `tests/scene-browser.mjs`: actual headless Chrome 154.0.8037.57, Windows build 10.0.26100, AMD Ryzen 5 6600H workstation. 320/375/430/768/1024/1440 px, 72 district selections across two projections; no horizontal overflow. Keyboard selection/focus, mayor movement, blur release, hidden-input rejection, real-session normal completion, pause/replay/skip/reduced motion, three remounts and emulated touch passed. No browser errors or failing resource responses.
- Performance sample: 15 illustrative actors, 41 motion updates over 1509 ms, mean measured motion-render work 0.516 ms. This is a short headless fixture measurement, NOT physical-device FPS or a real-atlas performance claim.
- Existing `tests/browser-smoke.mjs` also passed all six widths against the main shell/fallback on this branch. This does not prove the other branch's atlas adapter.
- Local `/api/analyze` POST with the official valid plan returned 502 `AI_PROVIDER_UNAVAILABLE`. A live successful AI analysis is NOT verified. No secrets were printed or changed.

Reproduce: run `PORT=3012 npm start` using the appropriate shell syntax, provide Playwright through `PLAYWRIGHT_MODULE_PATH` if it is installed externally, then `node tests/scene-browser.mjs`. The browser script defaults to `http://127.0.0.1:3012/scene/dev.html`; `AKIM_SCENE_TEST_URL` can override it. Reports/screenshots remain under ignored `.codex-private/scene-evidence`.

## Remaining owner requests

| Task | Owner / next action |
|---|---|
| GIS boundaries and dates | Existing map agent; no duplicate mapping work from this task |
| City statistics and sources | Existing data agent; keep observations separate from model weights |
| ZIP/assets/license intake | Existing asset agent; referenced `astana-map-data.zip` was not found locally; raw scripts were not executed |
| Camera/two projections | Coordinator retests our checks against the newer atlas |
| District picking/geometry | Coordinator preserves atlas dispatch and current source checks during merge |
| Mayor bounds/collisions | New actor regression tests available for combined acceptance |
| Capped representative actors | Stable SVG node fix available; retest actual atlas path separately |
| Effects/replay/accessibility | Reconcile two runId implementations; retain current token, focus and hidden-input checks |
| Chat/analysis/scenario comparison | Coordinator assigns server/API owner; current local provider request failed. AI may propose, never silently apply or score a plan |
| Supabase storage/security | Separate coordinator decision: identify project/schema first; consider versioned city datasets and source records with read-only public access to approved versions. No migrations, RLS changes or database connection were performed here |

UI owner: in the existing fixture scene at 320/375 and tilted 430 px, camera controls overlap the Saraishyk label anchor. Browser tests use the exposed pan button before map selection; touch targets near camera controls can also be retargeted to those controls. Move camera controls outside the map or reserve a non-overlapping safe area, then rerun acceptance. No styling change was made because the user assigned interface work to another agent.

Physical touch, production geography/assets, full atlas integration, live AI, Supabase and deployment remain separate checks. The main branch and deployment were not modified.
