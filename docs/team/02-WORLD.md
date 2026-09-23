# Laptop 2: city renderer, camera and motion

Work on `codex/akim-world` from the announced shared baseline. Read accepted design and contracts. You own the interactive scene; preserve other owners' code.

## Ownership and subagents

Owned: `scene/index.js`, `scene/world.js`, `scene/camera.js`, `scene/actors.js`, `scene/effects.js`, `scene/styles.css`, `scene/dev.html`, `scene/dev.js`, `scene/fixtures/**`, `tests/scene-camera.test.js`, `tests/scene-effects.test.js`, `docs/team/reports/world.md`.

Assign camera/geometry files to one subagent, actor files to another, effect files/tests to a third. You own world composition, index and CSS. Separate writing worktrees; all workers use v1 event names and schemas. They must not alter shared contracts independently.

Do not edit `app.js`, HTML shell, global CSS, session/engine, server, dependencies, actual asset files or source geography. Send exact requests to the lead or asset owner.

## Execution order

1. Implement `createScene` from 04-CONTRACTS against a fixture snapshot and clearly labeled schematic geometry. The module and dev harness must run before the ZIP arrives; fixture geography is not Astana evidence.
2. Use one world coordinate model and two projections. Selection/hit-testing, labels and marker placement remain aligned after toggle/resize. Keep labels upright; test forward/inverse projection round trips.
3. Consume six approved district polygons. Five accept policy targeting; Сарайшық is inspectable context only. Every scored district is playable from overview even if only one has a detailed scene. Do not silently display five map regions as the entire current city.
4. Support pan/zoom/reset, overview/close-up, keyboard and touch alternatives. Separate pan gestures from clicks. Controls outside the scene keep working, and page scrolling is not trapped.
5. Add mayor keyboard movement and click/touch destinations in the first detailed district. Clamp to declared walkable decorative areas. Movement does not change assigned policies, budget or score; there is no additional physics/building-placement simulation.
6. Animate capped representative people/cars/buses/LRT using approved paths and observations. Do not create one sprite per actual resident. Show scale/source metadata via the inspector; unknown counts remain unknown. Do not claim a scenario LRT route is verified live service.
7. Show queued policy markers and short per-decision feedback. Remove previews when the policy is removed. Citywide scenario policies reach exactly the five scored districts. No duplicated effect or score formula in scene modules.
8. Consume supplied presentation metadata for construction, delays and eight-quarter playback. Positive/negative reaction cues follow computed deltas. Skip/replay/reduced motion end at the same result. No unconditional cheering when indicators worsened.
9. Pause while hidden/in Calculator, cancel loops/listeners on destroy, and prevent duplicate actors on remount. Support fallback icons and report missing IDs. Use SVG initially; propose Canvas only with evidence and lead agreement about shared dependencies.
10. Review real ZIP assets in the scene. Send Laptop 3 exact ID/view/anchor/dimension requests. Provide screenshots, reproducible checks, measured performance and unresolved geography/data issues with the PR.

## Acceptance

Full overview plus one detailed scene, stable top/tilted selection, free camera, controllable mayor, capped city activity, complete cleanup, keyboard/touch access and no score side effects. All calculation/presentation input comes from the lead contract. Test at the exact contract/asset versions cited by the PR. Only Laptop 1 merges your PR into `codex/akim-25d-game`.
