# Three laptops: start here

This pack assigns implementation to three humans, each supervising one AI orchestrator and bounded subagents. Read [the accepted design](../GAME-DESIGN.md). These are planned tasks; the interactive game is not yet implemented. Branch/module names here replace earlier informal suggestions.

| Laptop | Human | Responsibility | Feature branch |
|---|---|---|---|
| 1 | You, coordinator | Session, calculator/game shell, scoring integration, saving, server, final reviews/merges | `codex/akim-session` |
| 2 | Experienced teammate | Map renderer, cameras, mayor, people/transport and animation | `codex/akim-world` |
| 3 | Newer teammate with supervised agents | Asset ZIP, geographic/statistical evidence, asset consistency and QA | `codex/akim-assets-qa` |

Assign by responsibility, not an assumption about who has four months' experience. If you are the newer member, retain human coordination but get experienced review of Laptop 1's session/server work. Every person must understand and verify their contribution.

Integration branch: `codex/akim-25d-game`. Stable release branch: `main`. Only Laptop 1 merges into either. Feature PRs explicitly target the integration branch. One serial merge queue prevents concurrent integration races; no workflow can promise zero defects.

## Files to send

- Laptop 1: [01-LEAD.md](01-LEAD.md).
- Laptop 2: [02-WORLD.md](02-WORLD.md).
- Laptop 3: [03-ASSETS-QA.md](03-ASSETS-QA.md).
- Everyone: [04-CONTRACTS.md](04-CONTRACTS.md), [05-GITHUB-WORKFLOW.md](05-GITHUB-WORKFLOW.md), [06-ACCEPTANCE.md](06-ACCEPTANCE.md).
- Art producer: [07-ASSET-PACK.md](07-ASSET-PACK.md).

Give the entire folder and GAME-DESIGN.md to each laptop, not only its assignment. The ZIP handoff is portable, but GitHub becomes the authoritative copy after bootstrap.

## Copy-paste startup prompt

Replace ROLE_FILE with 01-LEAD.md, 02-WORLD.md or 03-ASSETS-QA.md:

> Be this laptop's orchestrator. Read docs/GAME-DESIGN.md, docs/team/00-START-HERE.md, docs/team/ROLE_FILE, and docs/team/04-CONTRACTS.md through 06-ACCEPTANCE.md. Report branch, clean/dirty status and shared base SHA first. Ask only about missing facts that block your role; do not repeat accepted product questions. Implement the role on its feature branch. Delegate independent work to up to three focused subagents, each with explicit files, contracts and checks. Tell every worker others are working and their edits must be preserved. Use separate worktrees for independent writers; otherwise use read-only reviewers or serialize edits. Read any applicable skill yourself, and do not assume tools/skills installed on another laptop exist here. Review and test subagent work before integrating it locally. Maintain one feature PR into codex/akim-25d-game and publish project progress there using the template. Do not message outside this project. Only the lead merges; ask the owner for cross-file changes rather than editing their files. Return exact commits, tested behavior, dependencies and gaps.

## Starting checkpoint

At preparation time on 2026-09-23, local integration HEAD was `ed79c25`, the existing calculator. The earlier design/starter art were staged, and this pack is new local work. No remote game baseline has been verified. Laptop 1 must publish the reviewed baseline and announce its resulting SHA before workers branch. The announced SHA, not the old one in this paragraph, defines the common starting point. Follow [bootstrap](05-GITHUB-WORKFLOW.md#bootstrap-on-laptop-1).

Preserve unrelated untracked `Yerkebulan`. Root local `AGENTS.md` and `.codex-private/` are private and ignored; never add them or copy them into shared documents. This pack and the existing code/tests contain the portable implementation context teammates need.

## Work in waves

1. Lead publishes the reviewed baseline and v1 contract. All laptops verify the same SHA.
2. In parallel: lead builds shared session/server resources; world owner builds the scene against labeled fixtures; asset owner reviews ZIP/map sources/real observations.
3. Merge compatible foundations serially, refresh feature branches, and connect the real overview plus one detailed district to the shared session.
4. Replace fixtures with approved art/geography, connect sourced statistics and computed reactions, and verify mode parity.
5. Freeze new features, execute acceptance, review one integration-to-main release PR, then release through the existing deployment workflow.

No hosted database is needed for local personal best. Accounts, multiplayer, leaderboard, extra resources, achievements and random crises are not assigned. Missing real data blocks claims of accurate geography/counts but not session, camera or asset-tool development.

## How coordination works

Each laptop has independent files and conversation state. Agents do not automatically know another laptop's progress. GitHub PRs are the shared record: read them at start, dependency changes, checkpoints and before merge requests. The lead posts the queue and latest tested integration SHA. Cross-owner requests name exact files, interface changes and reasons. Humans relay urgent blockers if the other agent is not running. No always-on monitoring has been configured by this pack.
