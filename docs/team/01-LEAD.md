# Laptop 1: coordinator and gameplay integration

You own the end-to-end playable flow and are the sole merger. Read the design, contracts and workflow. Code on `codex/akim-session`; merge PRs through a separate clean integration checkout. Never switch a branch beneath active workers.

## Ownership

- Existing: `app.js`, `index.html`, `styles.css`, `simulator.js`, `server.js`, `api/analyze.js`, `tests/simulator.test.js`, `package.json`, `README.md`, `.env.example` if needed.
- New: `game/session.js`, `game/preview.js`, `game/storage.js`, `game/presentation.js`, `game/scene-adapter.js`, `game/contracts.js` and `tests/session.test.js`, `tests/preview.test.js`, `tests/storage.test.js`, `tests/presentation.test.js`, `tests/server.test.js`.
- Shared contracts/docs, CI, dependencies/lockfiles, deployment config and root styles belong to you.
- Other owners control `scene/**`, `assets/game/**`, `data/**` and their tests. Request changes rather than patching them concurrently.

## Bounded subagents

1. Session/storage worker: session + storage modules and their tests.
2. Preview/presentation worker: preview + presentation modules and tests. Any engine helper refactor is coordinated with you.
3. Read-only integration reviewer: state parity, stale AI responses, server routing and regression risks; alternatively assign exclusive server/test files.

You own app composition and shared interfaces. Supply every worker the v1 contract. Give independent writers separate worktrees, integrate their commits into your feature branch serially, and retest. Workers do not push your parent branch or change Git state in your checkout.

## Execution order

1. Bootstrap the reviewed team baseline and record its SHA. Verify other laptops can fetch it. Implement the v1 contract as JSDoc/constants in `game/contracts.js`, and provide fixtures/stubs so no branch imports a nonexistent sibling module.
2. Extract the closure-owned `app.js` plan into `createGameSession`. Game and Calculator dispatch to the same store. Preserve draft insertion order; the engine sorts confirmed plans. Draft edits clear final result, animation and stale AI; mode/projection changes preserve decisions/results.
3. Implement policy previews using shared lag/effect logic. Incomplete plans have no score. Show costs, scope, delay, affected indicators and validation; never add standalone policy effects into a fake city score. Confirmation uses `calculatePlan`.
4. Implement versioned local personal best. Store/recompute valid plans, compare full-precision scores, reject corrupt/incompatible saves, and handle unavailable/quota-full storage. Local storage is user-editable; this is a personal best, not a verified competition ranking.
5. Add Game/Calculator and Top-down/Tilted switches, district inspector, confirmation and result UI. Switching preserves state. Hide/pause the scene in Calculator; if graphics fail, the calculator remains usable with the same draft.
6. Build deterministic presentation metadata from confirmed effects and lags. Support pause/speed/skip/reduced motion; all paths end in the identical result. Intermediate visual frames are not official quarterly scores. Revision tokens prevent old animations/AI from modifying edited plans.
7. Extend safe static serving. `server.js` currently allowlists only five root files; new game/scene/assets/data requests otherwise return 404. Add intended public files/prefixes with correct JS/CSS/SVG/JSON/image MIME types and path checks. Do not serve the whole repository or private/env files. Test missing and traversal paths as well as successful resource loads.
8. Preserve the optional AI route's server calculation boundary. Ignore/cancel obsolete requests; unavailable AI cannot break either mode. Report live AI only when verified with configured access.
9. Wire reviewed scene/assets/data contracts. Test all five playable districts plus context-only Сарайшық. Update README only to implemented behavior. Queue owner PRs for defects found in their modules.
10. Freeze features, execute 06-ACCEPTANCE, review the release PR and merge serially. A later deployment needs actual post-deploy checks; do not report a URL based on a local run.

## Checks and handoff

Run `npm test`; add meaningful tests for partial-plan null scores, mode/projection parity, invalidation, source example `56.54307`, corrupt/stale saves and animation skip determinism. Test asset URLs through the actual server. Browser evidence covers both modes, selection, camera, mayor movement, keyboard/touch and required widths. Name actual machine/browser for performance evidence.

Post contract version, base/head SHA, tests run, module readiness and dependencies on your feature PR. Maintain the serial integration queue. Review each incoming diff, ownership, sources and tested head; if the head/base changes, retest affected behavior before merging. Cross-owner conflict resolution needs both owners' review. Only you merge integration/main.
