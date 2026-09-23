# Acceptance and merge gates

This is a checklist for future implementation, not completed test evidence. Each PR marks PASS / FAIL / NOT RUN and records the exact tested SHA. Do not infer a browser pass from unit tests or a deployment pass from a local run.

## Baseline and core correctness — Laptop 1

- `npm test` passes on the candidate. The two official controls remain: baseline `52.55768`; M7→Нура, M8→Нура, M10→Нура, M12→city, M5→Сарыарка costs 95 and yields `56.54307` with zero critical cells. UI rounds only for display.
- Five unique measures; total cost <=100; direction maximum 2; correct city/district targeting; all incompatibilities. Invalid or partial plan has no score.
- Reordering the same choices does not change score. Draft insertion order remains usable for visual feedback.
- Preview shows policy effects/lag/cost, never invented partial city scores. Existing nonlinear score and synergy rules are preserved.
- Same plan in Game and Calculator produces identical result. Repeated mode/projection switches preserve draft/result and cannot add policies or charge budget twice.
- Editing a confirmed plan removes old result, cancels old replay and prevents an old AI response from attaching to the new draft.
- Personal best persists across reload and is recomputed from saved plan. Corrupt/old/invalid saves and unavailable storage do not crash either mode. UI describes it as local personal best.

## City and interaction — Laptop 2, reviewed by Laptop 3

- Six sourced geographic districts visible. Five accept policies; Сарайшық shows context/unscored and cannot be assigned. Global scenario policies affect five, not six.
- All five districts can be played from overview/Calculator. Full overview plus one polished close-up meets the first scope; missing other detailed scenes are clearly indicated.
- Top-down/tilted share geometry. Selection, labels, hit-testing, actor anchors and camera focus remain aligned after toggle, zoom and resize.
- User can pan/zoom/reset, inspect a district, choose a policy, confirm a valid plan, watch/skip playback and replay. Keyboard alternatives work; actual touch is tested or explicitly unverified.
- Mayor movement works in the detailed scene, stays within its movement bounds and changes no scoring state. Selecting a district is not confused with dragging the camera.
- Representative people and vehicles animate smoothly within the documented cap. No unsupported real-world count/status claim; sources/dates are inspectable.
- Per-decision feedback is reversible preview. Final construction/reactions follow confirmed effects, including negative trade-offs. No random disasters, extra currencies or bonus points.
- Pause/speed/skip/reduced motion arrive at the same final result. No official quarterly score is fabricated. Hidden/unmounted scene stops work; remounting does not duplicate actors/listeners.

## Assets and real data — Laptop 3, reviewed by lead/world owner

- ZIP inventory and source manifest cover every imported asset. Assets have stable IDs, view/anchor/frame metadata, correct path case, working transparency and no missing references.
- Map polygons/holes/parts align and source date/projection/rights are recorded. A generated map picture alone is insufficient. Visual/source verification complements schema checks.
- Real population/bus/LRT claims have metric definition, geographic scope and reference date. Population weights in the synthetic engine were not reused as current counts.
- City totals are not falsely allocated by district. Fleet, active vehicles, routes and ridership are distinct. Missing value is null/unknown; mismatched dates/boundaries have notes.
- Sprite sampling/cap is documented. Animation policy changes do not rewrite observed counts or claim exact beneficiaries.
- Existing starter assets are distinguished from final received art; missing assets/data are reported, never labeled complete.

## Integration and visible quality — all laptops, lead accepts

- Node server actually serves game/scene modules, data and art with correct MIME. Private/env/source-context files and traversal paths are inaccessible.
- No browser console errors, failing asset requests, stale result panels or broken optional AI fallback in the main scenario.
- Check 320, 375, 430, 768, 1024, 1440 px: no horizontal overflow, clipped controls, unreadable labels or inaccessible confirm/reset. Inspect the real rendered UI.
- Test visible text in every language actually supported. Existing Russian is the initial assumption; additional language support is not claimed without implementation/checks.
- Reduced motion preserves meaning, sound defaults muted if included, controls have labels/focus states, and map color is not the only way to identify selection or errors.
- Measure performance on the intended demo machine: record browser, scene cap and interaction conditions. Avoid invented FPS targets/results; fix visible stalls and runaway work. If only desktop was tested, state mobile performance remains unverified.
- Clean-start run reproduces README instructions. Diff contains only scoped work; no secrets/private notes/temporary ZIPs/unrelated files. Real AI, deployment and hackathon submission are separate evidence items.

## Reproducible demo path

1. Start local server using `npm start`; open the site with clean or known storage state.
2. Enter Game, inspect full city, focus first detailed district, move mayor, pan/zoom and switch projection.
3. Inspect Сарайшық and confirm policy assignment is unavailable; return to a scored district.
4. Add the official sample measures; show cost/preview feedback. Switch to Calculator and verify same five choices/budget.
5. Remove one decision: no final score. Restore it and finalize: score displays 56.54 (Russian formatting may use comma).
6. Replay with animation and skip/reduced motion; verify identical final data and no duplicate personal-best update.
7. Reload to see the recomputed local best. Edit a new plan while optional AI is pending; old AI must not attach to it.
8. Disconnect/disable optional AI and verify deterministic simulator remains usable. Inspect source/context explanation and any missing-data notices.

## Minimal test report

```text
PR / branch:
Tested HEAD / integration base:
Contract / rules / assets versions:
Commands executed and results:
Browsers/devices and viewport sizes actually checked:
Official sample result:
Game <-> Calculator parity:
Map source/boundary review:
Real-data limitations:
Open defects and owners:
Not run and why:
Ready for merge: yes/no, with reason
```

No signed-off acceptance report exists merely because this template exists. The lead repeats relevant integration checks after each merge and completes the full demo before the release PR.
