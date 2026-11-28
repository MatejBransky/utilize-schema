# Fix

Implement and verify a minimal fix for a reproduced, verified bug.

**SCOPE: fix only.** Do not spawn subagents. Always append to `report.md`, even when the fix fails.

## Prerequisites

Read `triage/gh-<issueNumber>/report.md` and check the earlier steps:

- if the bug was **skipped** or **not reproduced** → append `FIX SKIPPED: not reproduced` and return `{ fixed: false, commitMessage: null }`;
- if the diagnosis confidence is **low** → do not guess a fix. Leave the failing test and the file/line list in `report.md`, append `FIX SKIPPED: low-confidence diagnosis`, and return `{ fixed: false, commitMessage: null }`;
- if the verdict is **intended-behavior** → the pipeline should not reach this step, but if it does, stop and return `{ fixed: false, commitMessage: null }`.

A failing test plus a precise map of the relevant files is a useful outcome. A speculative fix is not.

## Step 1: Implement the smallest change

- Change source under `packages/<pkg>/src` only.
- Fix the cause, not the test. Do not special-case the reproduction schema unless the special case is the documented behavior.
- Do not refactor unrelated code, add features, or change public API unless the bug requires it.
- If the bug is in the shared parser/linker, expect the change to affect more than one generator. Check parity.
- Follow the surrounding style: tabs, no semicolons where the file omits them, `oxfmt`/`oxlint` rules.

## Step 2: Keep or promote the regression test

The reproduce step wrote `packages/<pkg>/test/triage/issue-<number>.test.ts`.

- If the fix works, promote the test to a permanent, domain-named location. Either add the case to the matching existing file (for example `packages/zod/test/object.test.ts`) or create a descriptive file such as `packages/zod/test/dependentSchemas.test.ts`. Remove `test/triage/` when it is empty.
- The test must fail without the fix and pass with it. Run it both ways if you are unsure.
- If the bug cannot be captured by a test, explain why in `report.md`. Do not force a meaningless test.

## Step 3: Rebuild and run the checks

If you changed `packages/json-schema`, rebuild before testing the generators that consume its `dist` output:

```sh
pnpm build:dev
```

Then run the checks that match the change:

```sh
pnpm --filter @utilize/<pkg> ci:test
pnpm --filter @utilize/<other-pkg> ci:test   # if the shared layer changed
pnpm check:types
pnpm check:format
pnpm check:lint
```

For parser, dialect, or keyword changes, also run the official suite for every affected generator:

```sh
pnpm --filter @utilize/zod test:suite
pnpm --filter @utilize/effect test:suite
pnpm --filter @utilize/typescript test:suite
```

**Never** run `pnpm --filter @utilize/<pkg> update:suite-baseline` to make a suite failure go away, and never edit `knownFailures.ts`, `knownFailureInstances.ts`, `knownGaps.ts`, or `baseline.ts`. If the fix closes a tracked gap and changes the expected-failure set, **revert the source change, keep only the failing test, and return `{ fixed: false, commitMessage: null }`**; a maintainer has to update the baseline in a separate reviewed change. A red suite in a bot PR is worse than no PR.

If `pnpm check:format` fails, run `pnpm format` (or `pnpm exec oxfmt <changed files>`) and re-run it. Fix lint errors by hand; do not disable a rule.

Do **not** run `pnpm verify`: it needs a Playwright browser for the playground tests, which the triage runner does not install. If the fix touches the playground, run `pnpm --filter playground check:types`; skip the browser test project.

## Step 4: Add a changeset

Every fix that touches `packages/*` needs a changeset, including one-line and comment-only behavior changes.

```sh
pnpm changeset --empty
```

Edit the new `.changeset/*.md` file:

```md
---
'@utilize/zod': patch
---

Describe the user-facing fix in one line.
```

Use `patch` for a bug fix. Use `minor` only if the change adds a public option or API. List every affected package.

## Step 5: Update the docs

If the visible behavior, supported keyword, or dialect policy changes, update the relevant README or `docs/*.md`. If the fix only corrects an internal branch, no docs change is needed.

## Step 6: Clean up the working tree

The workflow runs `git add -A` and commits everything, so the branch must contain only the fix, the test, the changeset, and any docs change.

- Remove debug `console.log` calls and scratch scripts.
- Remove `preview-release.json` if a preview run left one.
- Restore `pnpm-lock.yaml` if it changed: `git checkout -- pnpm-lock.yaml`.
- Remove any `__generated__-*` directories that are not gitignored.
- `triage/` is gitignored; it may stay.
- Run `git status` and review every changed file.

Never commit, push, or open a PR. The workflow owns that.

## Step 7: Append to `report.md`

Add a `## Fix` section with:

- what changed and why;
- the files changed;
- the regression test and where it lives;
- the commands you ran and their results;
- the changeset file and packages;
- `git diff --stat` and the full diff (unless it is very large);
- anything a reviewer should know, including remaining risks.

## Output

Return `{ fixed: true, commitMessage: "fix(<scope>): <summary>" }` when the fix and checks pass. The scope is the package (`zod`, `effect`, `typescript`, `json-schema`, `playground`) and the summary matches the repository's commit style, for example:

- `fix(zod): validate __proto__ properties against the raw input`
- `fix(json-schema): apply $ref siblings in 2019-09 and 2020-12`
- `fix(effect): preserve defaults when decoding allOf`

If the fix fails, return `{ fixed: false, commitMessage: null }` and explain what was tried in `report.md`.
