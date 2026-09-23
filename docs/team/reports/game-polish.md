# Game and forecast polish — 2026-09-23

The main screen now centres on the map, five decisions, budget and forecast. The atlas no longer renders the secondary places list or search sidebar. Policy cards use generated artwork; plan editing has two keyboard-accessible tabs. Detailed rules and indicator tables are collapsed until requested.

The forecast retains the original DOCX-derived deterministic engine in `simulator.js`, unchanged by this work. `game/forecast.js` calculates up to three valid improvements by replacing one decision. This is a bounded comparison, not a global optimiser. AI analysis and advice receive server-computed facts and alternatives; provider text cannot change the score.

Generated exports are registered in `game/art.js` (209 variants); all 52 game-manifest entries resolve. Map actors, vehicles, policy objects, UI icons and policy cards use the relevant variants. Directional frames and alternative projections are selected contextually. Map life and feedback are decorative and do not determine scores. Added/reassigned district decisions focus their location once without overriding later manual panning.

## Verification

- `npm test`: 168 passed, zero failures or skipped tests.
- `node tools/check-assets.mjs`: 52 entries pass; legacy geography remains explicitly unverified.
- `git diff --check`: passes.
- `tests/browser-smoke.mjs`: 9 checks pass, including all 14 policy images, applying a forecast suggestion, both mocked AI modes, stale-response cancellation and provider-unavailable fallback.
- `tests/integration-browser.mjs`: 36 checks pass, including 30 layout checks at 320, 375, 430, 768, 1024 and 1440 pixels. No overflow, clipped controls, JavaScript errors or resource failures; one navigation-cancelled stylesheet is recorded separately.
- Official example: budget 95, score 56.54307. Tested one-change suggestion: budget 100, score 57.20556.
- District auto-focus verified separately in a real 375px browser for Saryarka and Baikonur upgrades.

Browser evidence is stored locally under ignored `.codex-private/browser-evidence/` and `.codex-private/integration-browser/`.

## Limits

Live OpenAI verification returned HTTP 401 `invalid_api_key` for the active server credential. Mocked browser checks do not prove live provider success. No credentials or upstream error messages are exposed to the client. Physical touchscreen and a full frame-time performance benchmark were not tested. Geography source/date and reuse limitations remain in the existing source register. These are local checks; no production deployment or Git push was performed.
