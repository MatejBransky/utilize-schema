# Agent notes

## ui-sdk

This project uses [ui-sdk](https://ui-sdk.dev/) via `@ui-sdk/react` and
`@ui-sdk/core` in the `playground` app.

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read
`node_modules/@ui-sdk/react/docs/llms.txt` (in this pnpm workspace:
`playground/node_modules/@ui-sdk/react/docs/llms.txt`). To build a new
component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading and
read `rendering.md` next to it.

## Fallow skills and gates

The `fallow` and `fallow-setup` skills in `.agents/skills/` (and their pointers
in `.claude/skills/`) are written by `pnpm exec fallow agent install` and
follow the installed `fallow` version from the pnpm catalog. They are not
listed in `skills-lock.json`, which only tracks skills installed with the
`skills` CLI from a remote source (`ui-sdk`). Rerun `fallow agent install`
after a fallow upgrade instead of editing them.

`.mcp.json` registers the fallow MCP server (`pnpm exec fallow-mcp`), which
exposes the same analyses as tools.

The local gates (the Claude Code hook below and the optional Git pre-commit
hook) block only a `fail` verdict. CI also fails on a `warn` verdict, through
`scripts/fallow-gate.mjs --warn`. Run `pnpm fallow:audit:ci` before you hand off
a pull request to run the same check as CI. `git commit --no-verify` skips the
Git pre-commit hook for a WIP commit that will be squashed; it is not a way
around a finding. Fix the code, or change `.fallowrc.jsonc` with a documented
reason.

## Styling

Do not add Tailwind CSS. Use CSS Modules (`*.module.css`) for app-specific
styling and the `--ui-*` tokens plus `data-slot` attributes for ui-sdk
components.

## Commands

- `pnpm install` — install the workspace with the pinned pnpm.
- `pnpm build:dev` — build every package with tsdown.
- `pnpm --filter @utilize/<pkg> ci:test` — run one package's test suite.
- `pnpm check:types`, `pnpm check:lint`, `pnpm check:format` — static checks.
- `pnpm triage:test` — unit tests for the issue-triage state machine.
- `pnpm verify` — the full local gate; it needs the Playwright shell for the
  playground tests.

## Bug-fix guardrails

- Never edit `knownFailures.ts`, `knownFailureInstances.ts`, `knownGaps.ts`,
  `baseline.ts`, snapshot baselines, or run `update:suite-baseline` to make a
  test pass. A baseline change is a reviewed decision, not a fix.
- Do not change dependency manifests, `pnpm-workspace.yaml`, the lockfile, or
  `.github/workflows` while fixing a bug.
- A fix under `packages/*` needs a changeset (`pnpm changeset --empty`).
- Issue triage runs through `.agents/skills/triage` and `scripts/triage`; see
  `docs/triage.md`.

---

<!-- fallow:setup-hooks:start -->

## Fallow checks

Use fallow for code-quality, cleanup, and setup tasks in this repository. Fallow checks the changed code before each `git commit` in Claude Code and before each `git push` there through the same gate. In Claude Code, a PreToolUse hook from `pnpm exec fallow agent install` runs this check and blocks the command when the verdict is `fail`. The optional `pnpm hooks:install` installs a Git pre-commit hook only; other agents and pushes outside Claude Code run the check themselves: `pnpm exec fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before you try again. A JSON runtime error such as `{ "error": true, ... }` does not block.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `"gate": "all"` in the `audit` section of `.fallowrc.jsonc` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to...                                        | Run                                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete an "unused" export or file                                    | `pnpm exec fallow dead-code --trace <file>:<export>`                                                                                                                      |
| prove a TypeScript symbol's exact consumers before refactoring       | `pnpm exec fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>`                                                                                 |
| find how one module reaches another                                  | `pnpm exec fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.)         |
| delete an "unused" dependency                                        | `pnpm exec fallow dead-code --trace-dependency <name>`                                                                                                                    |
| migrate a dependency                                                 | `pnpm exec fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.)   |
| commit or open a PR                                                  | `pnpm exec fallow audit --base <ref>`                                                                                                                                     |
| read a diff before approving it                                      | `pnpm exec fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row)                                          |
| prioritize refactoring                                               | `pnpm exec fallow health --hotspots --targets`                                                                                                                            |
| ask who owns code                                                    | `pnpm exec fallow health --ownership`                                                                                                                                     |
| check untested-but-reachable code                                    | `pnpm exec fallow health --coverage-gaps`                                                                                                                                 |
| improve or check the tests of a change                               | `pnpm exec fallow mutation --plan --base <ref>` (The plan runs no code. Without `--plan`, the command runs the project tests against each mutant, so ask the user first.) |
| consolidate duplication                                              | `pnpm exec fallow dupes --trace dup:<fingerprint>`                                                                                                                        |
| find feature flags                                                   | `pnpm exec fallow flags`                                                                                                                                                  |
| check which architecture rules apply to a file before changing it    | `pnpm exec fallow guard <files>`                                                                                                                                          |
| check import cycles, boundaries and policy rules after changing code | `pnpm exec fallow architecture`                                                                                                                                           |
| surface security candidates                                          | `pnpm exec fallow security`                                                                                                                                               |
| understand a finding                                                 | `pnpm exec fallow explain <issue-type>`                                                                                                                                   |
| scope a monorepo                                                     | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command)                                                                                      |

<!-- fallow:setup-hooks:end -->
