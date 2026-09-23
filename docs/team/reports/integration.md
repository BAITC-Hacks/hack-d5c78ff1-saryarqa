# Branch integration — 2026-09-23

Integration branch: `codex/akim-integration`. Intended shared local branch: `codex/akim-25d-game`. This report records local integration, not deployment or platform submission.

## Reviewed inputs

| Branch / commit | Decision |
| --- | --- |
| Shared foundation `61a9b76` | Base; already includes session `c769482`, session-store `96ddf08`, preview `4ac520b`, server `3dd868a`. |
| Assets `053cba4` | Merged with full author history and art exports. Runtime manifest binding remains incomplete. |
| Remote world `0051641` | Merged sourced atlas, geometry, application adapter and server integration. |
| Gameplay fixes `da17f38` | Merged after the active owner committed. Includes local playback `f42d787`, navigation tests `79e5ea7`, and renderer fixes `8f381b7`. Conflicts reconciled manually. |
| Local `main`, Claude memory branch | Already ancestors of foundation; no additional implementation. |
| Remote `main` `772b22f` | Only extra project placeholder; excluded from feature integration. |
| README sources `463af00` | Reviewed and factually incorporated in README. Branch itself not merged because it contains unsupported AI-coordinate behavior. |

## Conflict decisions

- Preserved the remote atlas dispatch and its renderer, vehicle heading, image fallback, and source metadata.
- Added stable district controls, actor-node reuse, inspector focus retention and hidden/blur input guards to the fixture renderer.
- Kept both playback test sets, stale plan/run protection, explicit invalid-ID rejection and compatibility for legacy fixtures without a run ID. An unidentified snapshot cannot replace an identified run of the same plan.
- Kept real-map `scene/dev.html` and preserved the other owner's session-based fixture as `scene/dev-fixture.html`; only that additional HTML entry is allowed by the server.
- Fixed results-header wrapping at 320 px and removed a missing-favicon request. Normalized two map text files to pass whitespace checks.

## Executed checks on the combined tree

- `npm test`: **135 passed, 0 failed, 0 skipped**.
- `node tools/check-assets.mjs`: structure/reference checks pass for 52 entries. Warnings remain: 14 ready, 24 placeholder, 14 missing; separate legacy geography remains unverified.
- `node tools/check-assets.mjs --strict`: exit **2**, expected release gate failure for these incomplete/unverified resources; full asset readiness is not claimed.
- Chrome 154 actual-atlas integration: **24 checks passed**, including official budget 95 / displayed score 56.54 / zero critical cells, Game–Calculator parity, natural replay, skip, Nura movement and both projections.
- Main app, standalone atlas and expanded editor checked at 320, 375, 430, 768, 1024, 1440 px: no horizontal overflow or clipped controls. No page/console errors or failed live resources. One stylesheet cancellation during explicit navigation was recorded separately.
- Fixture browser acceptance: 72 district hit tests, keyboard/blur, shared-session exact score 56.54307, pause/replay/skip/reduced motion, hidden/remount behavior and emulated touch passed; no script/resource errors. Physical touch was not tested.
- Git whitespace check passes. Private instructions and working environment files are not tracked; only `.env.example` is included. Pattern checks are not a full security audit of Git history.

Browser screenshots and detailed machine-specific logs remain in ignored local evidence folders.

## Remaining limits

The new art exports are preserved but not fully mapped to runtime IDs; the atlas uses its existing programmatic visuals. Source boundary dates/reuse and some landmark identities remain unverified as documented in the source registry. Live AI, physical mobile performance, deployment and submission are not established by this integration. Existing working checkouts and unrelated untracked files were preserved.
