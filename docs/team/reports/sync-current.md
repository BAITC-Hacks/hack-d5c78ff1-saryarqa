# Integrated city maps and current team work — 2026-09-23

Inputs: local `c01e841`, remote `codex/local-complete` at `19c2872`, and the frozen current team changes for accounts, cloud persistence, advisor, game cockpit and NPCs. The shared working directory was preserved while integration ran in a separate worktree.

## Reconciliation

- Kept the game cockpit, district placement, undo, shared session, draft persistence, accounts, server routes, cloud history/ranking, advisor and walking controls.
- Integrated Astana, Almaty and Shymkent source snapshots and the city selector. Other cities are geographic browsing only; Astana's plan, result and application mode survive a round trip.
- Applied the mint palette to the existing game layout. Corrected header contrast and mobile account-button clipping.
- Preserved source geometry while batching full-city roads and buildings. The measured initial Astana SVG path count fell from 70,256 to 2,680 in the same desktop viewport.
- Retained legacy tiled Astana support, terrain/vegetation, NPCs, playback timing and official deterministic scoring. Added gzip routes alongside the existing protected static-file allowlist and backend APIs.

## Verification performed

- Final integrated unit/HTTP suite: **232 passed, 0 failed, 0 skipped**.
- Asset checker: **52 entries pass**; geographic-source qualifications remain documented.
- Existing Chrome integration: **36 checks**, **30 responsive measurements**, no page/console/resource errors.
- New `tests/sync-browser.mjs`: **8 checks pass**, including all three cities, official budget 95 / score 56.54, district placement/undo, profile dialog, return to calculator and draft restoration after reload.
- Viewports: **320, 375, 430, 768, 1024, 1440**; no page overflow, header/title overlap or clipped login label in the final city-switch test.
- Git whitespace check passes. Current source scan: **196 text files**, no known local credential matches, no private context/environment/data files included. This is not a full history audit.

Evidence is stored under the ignored `.codex-private/sync-evidence/` folder in the integration worktree. No live AI request or cloud account write was made by the new city-switch test; those integrations have separate team evidence in `docs/INTEGRATIONS.md`.

## Limits

Full source snapshots remain large. First loading in the final local Chrome run took about 9 seconds for Astana and 22–23 seconds for the other cities; these timings are environment-specific. Physical mobile performance and a public deployment are not established by these checks. Submission and publication belong to the finalization task.
