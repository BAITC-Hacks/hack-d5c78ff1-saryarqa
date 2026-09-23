# Akim: accepted game direction

Status: product decisions accepted on 2026-09-23; this is an implementation specification, not a report of shipped game features. Read [team/00-START-HERE.md](team/00-START-HERE.md) for assignments. This replaces the earlier exploratory design.

## Experience

Play as the mayor of a warm miniature Astana. Explore using a free camera or controllable mayor, inspect a district, select a policy, preview effects, and watch the city respond. Aim to beat your local personal best. Game and Calculator modes share one plan and one scoring engine.

Game/Calculator selects the interaction style. Top-down/Tilted selects the scene projection. Overview/Close-up selects the level of detail. Minecraft and Clash of Clans describe the desired agency and visible activity; a first-person voxel world, combat, raids and resource harvesting are outside this release.

## Accepted answers

| Question | Decision |
|---|---|
| 1 | Highest score is the objective. |
| 2 | Switch between top-down 2D and tilted 2.5D. |
| 3 | Real six-district geography; Сарайшық is visible and inspectable but unscored. |
| 4 | Click a district, then choose a policy. |
| 5 | Calculation is district-level; exact object positions are visual only. |
| 6 | Free camera and controllable mayor. |
| 7 | City overview and district close-up. |
| 8 | Offer animated Game mode and direct Calculator mode. No manual tile-placement requirement was approved. |
| 9 | Continuous people/transport grounded in sourced real population and transport data. |
| 10 | Preview policy effects; reveal final score after confirmation of five valid decisions. |
| 11 | Per-decision visual feedback and an eight-quarter visual sequence with speed/skip controls. |
| 12 | Citizen reactions respond to computed indicator changes. |
| 13 | Existing budget, five decisions and official constraints. No extra achievements, crises, resources or score bonuses. |
| 14 | Local browser personal best. No accounts, shared leaderboard or hosted database. |
| 15 | Full city overview and one polished district close-up first. |

## Numerical and visual truth

The synthetic scenario in `simulator.js` remains authoritative: five distinct measures, budget at most 100, direction limits, lag factors, synergies, clipping and incompatibilities retain their meanings. Invalid or incomplete plans have no final score. Previews show policy costs, scope, delay and indicator effects, not a partial city score or additive contribution to score.

The source defines a final outcome across eight quarters, not a complete quarterly time series. The timeline visualizes construction/delay and final effects. Intermediate frames must not claim official quarterly scores or forecasts. Skip and replay end at the same computed result. Before confirmation, objects are queued/preview cues; removing a policy removes its preview.

Real-world context is separate: aggregate population, fleet/service counts, geography and routes. Scenario population fractions are scoring weights, not current resident counts. A citywide bus total cannot become invented district bus counts. Each observation carries a date, scope, definition and source; unknown is null, not zero. Different years or boundary vintages cannot be silently combined.

Use capped representative sprites, not one object per real resident. The inspector shows sourced totals and dates plus a short illustrative-scale explanation. Policy deltas can change animation behavior but cannot manufacture new measured population/bus totals or exact beneficiary counts. Verify LRT status and route against a dated source; M3 may depict a scenario extension without asserting live service.

## Gameplay loop

1. Enter either mode; show budget, five slots, baseline and personal best.
2. Pan/zoom the overview, switch projection, inspect districts and enter the supported close-up. Move the mayor in that scene.
3. Pick a policy, inspect lag-adjusted effects and constraints, and add it to the shared draft. Citywide policies take no district.
4. Switch modes/projection freely while preserving decisions. Queued markers and workers provide preview feedback.
5. Confirm a valid five-decision plan. Compute through the engine, then optionally watch construction and the eight-quarter visual sequence.
6. Reveal score, district changes, critical indicators and trade-offs. Save/recompute local best. The existing optional AI endpoint explains computed facts.
7. Edit/replay. Draft edits invalidate old results, old animation and stale AI responses.

## Map and art

Use one sourced geometry for both projections, with stable hit-testing and readable labels. Six regions are visible; only the five supplied districts receive scenario effects. All five remain playable through the overview and Calculator even before receiving detailed scenes. Сарайшық cannot be a policy target or silently inherit citywide scenario effects.

Prototype geometry may be schematic if visibly labeled in a development harness. Actual-geography acceptance remains open until sourced geometry is reviewed. Generated artwork is not boundary evidence. The initial 14 policy symbols and seven miniature pieces in `assets/game/` are starter art. A coworker will supply a ZIP; follow [the intake brief](team/07-ASSET-PACK.md).

Source leads, not certified game-ready geometry:

- [Astana development plan](https://www.gov.kz/memleket/entities/astana/documents/details/940185?lang=ru).
- [District boundary announcement](https://www.gov.kz/memleket/entities/astana-saulet/press/news/details/1274528).
- [Official city GIS entry](https://www.gov.kz/memleket/entities/astana/activities/15951?lang=ru&parentId=360).

## Implementation defaults and unknowns

Keep native JavaScript/Node. Begin with SVG geometry and CSS depth, with capped actors; propose Canvas only if measurement justifies it. No framework rewrite is required.

Нура is the proposed first close-up because it has the weakest supplied baseline; that is an implementation default, not an additional user answer. Retain Russian initially and make the demo desktop-first with responsive/touch access. The user did not give exact devices, languages or deadline in answer 15. Do not invent delivery promises; these gaps do not block modular work.
