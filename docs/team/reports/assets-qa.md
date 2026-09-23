# Laptop 3 — assets, city evidence and QA

Checkpoint: 2026-09-23. Status: **WORKING; full acceptance blocked by missing art, unverified boundaries and unavailable world integration.**

## Saved responsibility and continuation context

This task owns `assets/game/**`, `data/geography/**`, `data/city/**`, `tools/check-assets.mjs`, `tests/assets.test.js`, `tests/city-data.test.js` and this report, under [03-ASSETS-QA](../03-ASSETS-QA.md), [contract v1](../04-CONTRACTS.md) and [asset brief](../07-ASSET-PACK.md). Keep this report as the durable handoff for subsequent work. The accepted design is [GAME-DESIGN](../../GAME-DESIGN.md).

Work only on `codex/akim-assets-qa`. Target `codex/akim-25d-game`; Laptop 1 alone merges. Do not change app, global styles/HTML, scene, simulator, server, dependencies or database settings. Report cross-owner defects with evidence. Local personal best is the chosen storage scope. Unknown real data is null; synthetic scoring weights never become district population.

Three helpers completed independent work: city context in its two files, asset/data tests in their two files, and read-only geographic review. The orchestrator owned implementation integration, browser checks, Git and this report. Existing producer files under `assets/exports`, `assets/previews`, `assets/sources` were preserved and left untracked; a reviewed copy subset is committed separately. No other owner's files were changed.

## Branch and exact evidence versions

- Initial checkout: `codex/new-work`, `772b22f05bed30eb2d9157256dbe5f2da55f36d1`, with untracked assets.
- Published baseline fetched and used: `1ee0698c4e18788a30ab30bee560a8740bcd3989`.
- Tested implementation commit: **`9633eb925f20a56e679663c237b22ce3bf04858f`**.
- Browser-tested calculator code: baseline above, unchanged by the implementation commit. New files were reviewed in a separate temporary local asset server.
- Contract/schema version: 1. The baseline has no exported RULES_VERSION yet; do not claim the planned constant exists.

## Implemented and reviewed

- Safe ZIP intake: nine Markdown files only. Archive hash/inventory and source snapshot: [intake.json](../../../assets/game/intake.json). Entries inspected before extraction into a new OS temporary directory; no archive code executed or whole-repo overwrite. The raw ZIP is not committed.
- [manifest.json](../../../assets/game/manifest.json): **52 stable IDs — 14 ready policy icons, 24 placeholders, 14 missing**. Reviewed copies have actual viewBox sizes and provisional placement anchors, source IDs, explicit missing reasons and exact-case paths. Source/destination hashes record CRLF-to-LF normalization where applied. The two existing editable sprite files are reused.
- [SOURCES.md](../../../assets/game/SOURCES.md), [MISSING.md](../../../assets/game/MISSING.md), [contact sheet](../../../assets/game/CONTACT-SHEET.html) and [PNG preview](../../../assets/game/contact-sheet-preview.png). Static views checked against a checkerboard. Composite previews were not presented as transparent animated exports. No generated replacement art or fabricated frames.
- [astana.json](../../../data/geography/astana.json): six sourced districts, 10 disjoint exterior parts, 1,778 vertices retained; common world space for both projections; Saraishyk explicitly unscored. [Source review](../../../data/geography/README.md), retained Esri data/CRS and [visual evidence](../../../data/geography/review.png) included. All anchors are inside their own districts. No source routes supplied.
- [City context](../../../data/city/context.json): 3 sources, 11 observations. Verified city population 1,690,605 as of 2026-08-01, attributed to BNS. Six district counts, full bus fleet and LRT measured daily ridership null. Daily bus release 1,210 and 105 routes are undated **unverified** historical candidates and cannot drive sourced density. [Evidence notes](../../../data/city/README.md) distinguish fleet, release, routes and trips. CTS's 2026-05-17 notice supports passenger operations by that date; exact opening date and current continuity are not established.
- Dependency-free validators and 20 new regression tests cover paths/case, SVG active/external content, metadata/symbols/frames, dates/provenance/null, district identity, ring closure, holes and label containment. SVG inspection is a conservative intake gate, not a general sanitizer. Geometry checks do not certify real boundaries.

## Executed checks

| Check | Actual outcome |
| --- | --- |
| `node --test tests/*.test.js` on implementation commit | PASS, 28 tests: 20 new plus 8 existing engine tests |
| `node tools/check-assets.mjs` | PASS structure/reference checks; explicit placeholder/missing/unverified warnings |
| `node tools/check-assets.mjs --strict` | Expected nonzero release gate: incomplete assets and unverified geography |
| `node data/geography/export.mjs` | Six districts exported without simplification; metadata preserved |
| `node assets/game/contact-sheet.mjs` | Contact sheet regenerated with registered views and missing IDs |
| `git diff --cached --check` before implementation commit | PASS |
| Edge 153.0.4234.48, headless Playwright, Windows | Calculator smoke and screenshots at widths 320, 375, 430, 768, 1024, 1440; viewport height 900 |
| Keyboard focus + Enter on sample and calculate | PASS at all six widths: cost 95, score 56,54, critical count 0 |
| Reduced-motion emulation | Same score 56,54; game animation not present to test |
| Touch emulation 375×812 | Sample and calculate taps work; same score; no physical-device test |
| Calculator page script errors on initial width sweep | None observed; this is not game/scene console acceptance |

The exact mathematical sample remains 56.54307, cost 95; existing engine tests also preserve baseline 52.55768. Browser rendering is rounded to Russian `56,54`. All six widths had document scrollWidth equal to viewport width. That did not hide the 320 px clipping defect below: absence of page overflow is insufficient to pass clipping.

Browser records: [initial sweep](../../../assets/game/qa-baseline.json), [interactions and HTTP responses](../../../assets/game/qa-interactions.json). Screenshots: [320](../../../assets/game/qa-sample-320.png), [375](../../../assets/game/qa-sample-375.png), [430](../../../assets/game/qa-sample-430.png), [768](../../../assets/game/qa-sample-768.png), [1024](../../../assets/game/qa-sample-1024.png), [1440](../../../assets/game/qa-sample-1440.png). The in-app automation runtime failed to initialize due to workspace-path handling; the successful checks used bundled Playwright and installed Edge in an isolated headless browser. No personal browser profile was used.

## Open defects and owner requests

1. **P2 — clipped change-plan button at 320 px. Owner: Laptop 1, `styles.css` / results heading.** Tested app SHA `1ee0698c4e18788a30ab30bee560a8740bcd3989`, Edge 153.0.4234.48, 320×900. Load app, choose “Показать пример”, then “Рассчитать сценарий”; inspect the results header. Expected: entire “Изменить план” control within viewport. Actual: button right edge x=323.421875 beyond width 320, with visible border clipping. [Focused screenshot](../../../assets/game/qa-defect-320.png). No fix applied outside ownership; recheck at the owner's new SHA.
2. **Integration dependency — new public files return 404. Owner: Laptop 1, `server.js`.** Same tested app SHA/browser. GET `/assets/game/manifest.json`, `/data/geography/astana.json`, `/data/city/context.json` on the existing server: all 404. Expected after server integration: successful JSON with correct MIME and narrowly scoped public serving. Exact responses are in qa-interactions.json. This is a known missing foundation, not a claimed regression caused by these files.
3. **P1 acceptance blocker — boundaries not verified. Owners: Laptop 3 evidence, reviewed by Laptop 1/2.** Source area differs from official announcement: largest relative difference Saryarka −5.223%, city total +0.321%. Unknown boundary date and reuse terms; stale layer extent; tiny pre-existing endpoint inconsistencies. Keep status `unverified`, visible warning and common geometry. Do not rescale, snap or silently certify. See geographic source comparison.
4. **Art intake dependencies. Owner: art producer / Laptop 3 review; placement reviewed by Laptop 2.** Missing mayor/citizens/worker/emergency, car/LRT/service, school/clinic, corner/junction/crosswalk; current placeholders lack final rights/style/view/state approval. Tilted straight-road marking bends and needs paired-view review. Exact needs in MISSING.md. Existing local previews have multiple styles, opaque backgrounds and no documented animation frames.
5. **World integration unavailable. Owner: Laptop 2.** No world harness/scene files on this baseline. Need a concrete scene commit and its sampling/cap policy to test top/tilted alignment, real asset anchors, six-region inspection, mayor bounds, pause/skip/replay, reduced motion and scene lifecycle. Both mode parity and close-up acceptance are NOT RUN.

## Next checkpoint and acceptance

Publish this checkpoint as one draft feature PR to the integration branch. Lead/world owners review sources and consumer handling of `unverified`/null/missing. Request the producer's standalone export pack and source declarations, then replace placeholders without changing stable IDs. Recheck clipping/serving at Laptop 1's new SHA and execute full scene QA when Laptop 2's harness exists. Physical touch/mobile performance, live AI, deployment, full game parity and final geography acceptance remain NOT RUN.

**Ready for final merge/release: no.** This is tested asset/data groundwork and a reproducible defect report; it does not claim a finished city scene or verified current district map. No integration/main merge performed.
