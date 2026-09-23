# GitHub workflow: one merger, three feature branches

Repository: `https://github.com/BAITC-Hacks/hack-d5c78ff1-saryarqa`. Integration: `codex/akim-25d-game`. Release: `main`. Laptop 1 is the only merger. These commands are instructions, not a claim that branches or PRs have been published. Each laptop uses its own authorized GitHub account.

Use independent local clones, preferably outside cloud-synced folders. Never put the same live working copy on a shared/network/cloud drive used by multiple laptops. GitHub exchanges commits; it does not synchronize uncommitted files. Each subagent writing concurrently needs its own worktree or exclusive files without Git operations in the shared checkout.

## Bootstrap on Laptop 1

The current checkout has intentional staged starter art/design and unrelated untracked `Yerkebulan`. Inspect before any staging; do not discard user work. The updated handoff files are additional intended changes.

```powershell
git status --short --branch
git remote -v
git branch --show-current
git diff --cached --name-only
git diff --name-only
```

Expected branch is `codex/akim-25d-game` and remote must match the repository above. Stop on unexpected differences. Review all intended files and add only these paths (include only files that exist):

```powershell
git add -- docs/GAME-DESIGN.md docs/FUTURE-PLAN.md docs/team/00-START-HERE.md docs/team/01-LEAD.md docs/team/02-WORLD.md docs/team/03-ASSETS-QA.md docs/team/04-CONTRACTS.md docs/team/05-GITHUB-WORKFLOW.md docs/team/06-ACCEPTANCE.md docs/team/07-ASSET-PACK.md assets/game/README.md assets/game/measure-icons.svg assets/game/miniature-kit.svg
git diff --cached --check
git diff --cached --stat
git diff --cached
npm test
git commit -m "docs: define three-laptop Akim game implementation"
git push -u origin codex/akim-25d-game
git rev-parse HEAD
git ls-remote origin refs/heads/codex/akim-25d-game
```

Run each command sequentially and stop if it fails; PowerShell does not automatically stop after a native command's nonzero exit. Review confirms no private files/secrets/unrelated changes. If any unexpected staged path appears, resolve it with its owner rather than committing it. No broad `git add .`/`git add -A`.

Announce the full commit SHA to all three humans. Verify remote SHA matches. Do not invent a SHA or branch availability. The lead may put this announcement in the first coordinator draft PR; alternatively relay it directly while workers open PRs. If branch publication is blocked, share the Markdown pack but wait to start shared feature branches until the common commit is fetchable.

## Start each laptop

The first clone uses a fresh directory chosen by the human:

```powershell
git clone https://github.com/BAITC-Hacks/hack-d5c78ff1-saryarqa.git
cd hack-d5c78ff1-saryarqa
git fetch origin
git rev-parse origin/codex/akim-25d-game
```

Confirm this matches the announced baseline before branching. If the integration branch advanced, the lead announces the new baseline or supplies the still-intended commit. Do not silently start different foundations.

Run ONLY your assigned branch command:

```powershell
# Laptop 1
git switch -c codex/akim-session origin/codex/akim-25d-game
# Laptop 2
git switch -c codex/akim-world origin/codex/akim-25d-game
# Laptop 3
git switch -c codex/akim-assets-qa origin/codex/akim-25d-game
```

If a branch exists, inspect and switch to it; do not recreate/reset it. On the original lead checkout, finish bootstrap/commit first or use a separate clone/worktree to avoid carrying staged/unrelated files into feature work.

## Daily / checkpoint loop

Read your PR and coordinator queue. Inspect status and current branch. Commit your own reviewed checkpoint before merging integration changes; do not automatically stash dirty user files.

```powershell
git status --short --branch
git fetch origin
git merge origin/codex/akim-25d-game
```

Resolve any conflict before continuing. Re-run affected tests after a base merge. Add exact owned paths, inspect the staged diff, then commit and push your feature branch normally. Do not push integration/main, force-push, reset hard or use a whole-file "ours/theirs" resolution to hide another owner's work.

Use short checkpoints that can be reviewed independently: contract/stub, functioning module, integration readiness, polish. After a feature PR is merged, start its next cycle on a new branch from updated integration (for example `codex/akim-world-02`). This avoids confusing already-merged PR history.

## Pull requests

Create one draft PR per laptop into `codex/akim-25d-game`. Example after your first meaningful commit and branch push:

```powershell
gh pr create --draft --base codex/akim-25d-game --head codex/akim-world --title "feat: interactive Astana scene" --body-file pr-body.md
```

Replace head/title with your role. Use the GitHub web UI if CLI is unavailable. `pr-body.md` is a temporary local note, not part of the code changes. Verify base/head in the UI before creating. The coordination permission is for this project's PRs/issues; do not post elsewhere. No PRs are created by merely reading this pack.

PR body/checkpoint template:

```text
Owner / laptop:
Status: WORKING | BLOCKED | READY_FOR_REVIEW
Feature branch and full HEAD SHA:
Last integrated base SHA:
Contract version:
Changed owned paths:
Behavior now working:
Checks run (command/browser/viewport + actual outcome):
Evidence (screenshots or reproducible steps):
Dependencies / requested changes (owner + exact file/API):
Known gaps (including missing data/assets):
Next checkpoint:
```

Update after a meaningful checkpoint or blocker, not every agent message. Source claims link to evidence. The lead posts queue entries with PR number, tested head SHA, dependency and decision. No fabricated tests or "ready" while geography is an unverified fixture.

## Subagents on one laptop

The local orchestrator is the sole Git writer in its parent checkout. Read-only reviewers can share it. For independent writing, create worktrees from the feature branch's committed checkpoint:

```powershell
git worktree add ../akim-camera -b codex/akim-world-camera codex/akim-world
```

Use unique directory/branch names; never repurpose an existing directory. Give the worker exact paths and prohibit changes outside ownership. After reviewing its committed diff, merge its branch into the local feature branch serially and retest. Do not mix merge and cherry-pick for the same commits. Child branches do not bypass the parent to the main integration branch. Stop workers before their contracts/base are changed. No need for dozens of simultaneous agents; useful independence determines concurrency.

## Serial merge protocol: Laptop 1 only

1. Pick one PR whose dependencies are available. Typical order: session/serving contract foundation; asset/map manifest; scene; final shell wiring and QA fixes. Reorder only when explicit stubs make the candidate independently testable.
2. Feature owner merges latest integration into their feature, resolves owned conflicts and posts fresh tested HEAD. Lead reviews cross-owner conflicts with both owners.
3. Lead records current integration SHA and PR HEAD, checks the full diff/ownership, then tests the combined candidate in an isolated worktree. Keep stubs/dependencies explicit so a supposedly safe module merge does not break module imports.
4. Recheck base/head are unchanged. Merge only the reviewed HEAD. Inspect branch rules first: with a required merge queue, CLI may enqueue or enable auto-merge when checks are pending, so use the repository's reviewed UI flow and do not inadvertently enable auto-merge. Without that queue behavior, CLI can pin the head using `gh pr merge <number> --merge --match-head-commit <reviewed-full-sha>`; replace placeholders and use only if merge commits are enabled. Otherwise use the allowed method and start fresh feature branches after merge. Never bypass required checks or use admin overrides.
5. Fetch the merged integration SHA, run the relevant smoke checks, post it, then process the next PR. If broken, pause the queue; fix through an owner PR or create a reviewed revert commit. Never reset shared branch history.
6. After final acceptance, create one integration-to-main release PR. If main changed, reconcile it into integration and retest first. Main is not a workspace. Only report production success after actual deployment checks.

Do not enable auto-merge, change protections, or connect deployment automation merely because this guide mentions them. Existing configured protection/CI must be respected. Main/integration protection is a useful human repository setting if available; its configured status is not verified here.

## Sources for GitHub behavior

- [Branch/PR comparison semantics](https://docs.github.com/en/pull-requests/reference/branches).
- [Synchronizing a PR with its base](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch).
- [Explicit PR base/head in GitHub CLI](https://cli.github.com/manual/gh_pr_create).
- [Merge head pinning and queue behavior](https://cli.github.com/manual/gh_pr_merge).

The ownership and serial-queue rules are our project workflow. GitHub does not automatically enforce them unless corresponding repository rules are configured.
