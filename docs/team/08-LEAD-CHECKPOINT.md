# Laptop 1 foundation checkpoint

Owner: coordinator/gameplay integration. Branch: `codex/akim-session`. Target: `codex/akim-25d-game`, NOT main. Contract v1; scoring rules `hackalem-v1`.

Published starting baseline: `1ee0698c4e18788a30ab30bee560a8740bcd3989`. The GitHub integration ref was verified at that SHA. The feature PR records its exact tested head and subsequent integration SHA; do not infer the current remote head from this historical baseline.

## Implemented

- Shared immutable session, insertion-ordered draft, invalidation, Game/Calculator parity, focus/projection/view intents; five scored districts and context-only Saraishyk.
- Engine-derived policy previews with null draft score; deterministic final calculation and presentation metadata. No invented quarterly scores.
- Versioned local personal best with validation/recalculation and unavailable-storage handling.
- Shell, district inspector, outcome reveal, playback controls, keyboard focus preservation, stale AI cancellation.
- Optional scene adapter with capability detection, missing-resource fallback, visibility/reduced-motion context, teardown/retry and stale renderer guards.
- Safe static routes with MIME/path/symlink checks and HTTP tests. Optional AI still recalculates on the server.

Independent worker branches were integrated serially: `codex/akim-session-store`, `codex/akim-preview-playback`, `codex/akim-static-server`. A separate read-only integration reviewer found no blocking defect in the calculator/fallback foundation. No agent switched the parent checkout beneath another writer.

## Consumer notice: playback completion

Laptop 2 must send BOTH tokens from the current snapshot:

```js
onIntent({
  type: 'PLAYBACK_COMPLETE',
  planRevision: snapshot.planRevision,
  runId: snapshot.playback.runId,
});
```

Capture the tokens for that animation run. Missing/stale tokens are refused; replay increments runId even when the plan is unchanged. Never read fresh tokens just to complete an obsolete animation.

## Verification evidence

- Official example: cost 95, exact engine score `56.54307`, displayed `56,54`; baseline `52.55768` unchanged.
- Automated session/preview/storage/presentation/server/adapter tests cover invalid drafts, mode/projection parity, corrupt saves, skip/replay determinism and obsolete callbacks. Final command/count and tested SHA are recorded in the PR.
- Real headless Google Chrome `154.0.8037.57` on the coordinator Windows workstation: 320, 375, 430, 768, 1024, 1440 px; no horizontal overflow/clipped shell buttons or page errors. Keyboard focus, inspector/selection, Saraishyk restrictions, mode parity, best after reload, late AI response and reduced-motion fallback passed.
- Local evidence: `.codex-private/browser-evidence` (not published). Reproduce with `tests/browser-smoke.mjs` and Playwright/Chrome. AI interception tests stale-response handling; it is NOT a live OpenAI test.
- No FPS/performance benchmark, physical-touch test, mayor/camera/real animation test, real-data verification or new production deployment is claimed. Scene/assets/data are absent from this checkpoint.

## Serial integration queue

1. Laptop 1 session/serving foundation: independently reviewable; test the exact combined candidate in a clean integration worktree before merging its PR.
2. Laptop 3 asset manifest + verified geography/context: requires actual provenance/schema/source review. Owner keeps `assets/game/**`, `data/**` and their tests. Missing values remain unknown, not invented.
3. Laptop 2 scene: owns `scene/**` and tests. Must use shared contracts; requires verified map and compatible assets for integrated acceptance. Can develop against clearly labeled fixtures in isolation.
4. Coordinator wires reviewed owner PRs and repeats 06-ACCEPTANCE. Cross-owner conflicts require both owners' review. Only then open release PR to main.

Other laptops should fetch the announced integration SHA, merge it into their own clean feature branches, rerun their affected tests and post their HEAD/PR URL. Never copy another laptop's working directory or switch its active branch.

## Remaining gates

- Laptop 2: actual selection/hit-testing, top/tilted projection, camera, Nura mayor movement, capped actors, pause/speed/skip/reduced motion and cleanup browser evidence.
- Laptop 3: final manifest, six-region geography (with holes/multipolygons/date/source/projection), context sources/definitions and art provenance.
- Coordinator: verify all real assets via server, full end-to-end scene flow and production package/routing. Vercel `/api/capabilities` filesystem tracing must include intended resources; current local HTTP tests do not prove deployment packaging.
- No database, shared leaderboard or new dependency is introduced for this local personal-best scope.
