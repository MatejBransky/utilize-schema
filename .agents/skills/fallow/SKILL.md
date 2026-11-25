---
name: fallow
description: Codebase intelligence for TypeScript and JavaScript. Static analysis reports changed-code risk, cleanup opportunities, duplication, circular dependencies, complexity hotspots, architecture boundaries, design-system drift, feature flags, and opt-in security candidates. Opt-in mutation testing reports the code changes that no test detects. Optional local similar-code discovery finds functions that may implement the same intent despite different syntax. Runtime coverage can merge production execution data. Use when asked to audit PR risk, find unused code or dependencies, compare semantically similar functions, detect duplicates, inspect architecture boundaries, merge runtime coverage, improve or check the tests of a change, auto-fix supported issues, or run fallow.
license: MIT
---
<!-- fallow:agent-install v1 skill=stub version=3.45.0 -->

# Fallow

This pointer skill was written by `fallow agent install`. The complete, version-matched skill ships inside the installed npm package:

- `node_modules/fallow/skills/fallow/SKILL.md` (start here)
- `node_modules/fallow/skills/fallow/references/` (CLI reference, MCP tools, patterns, gotchas)

Read that `SKILL.md` before running fallow. Resolve current flags from `fallow --help` and `fallow <command> --help`, never from memory.

## Fallow task map

| When the agent is about to... | Run |
|---|---|
| delete an "unused" export or file | `pnpm exec fallow dead-code --trace <file>:<export>` |
| prove a TypeScript symbol's exact consumers before refactoring | `pnpm exec fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>` |
| find how one module reaches another | `pnpm exec fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.) |
| delete an "unused" dependency | `pnpm exec fallow dead-code --trace-dependency <name>` |
| migrate a dependency | `pnpm exec fallow trace --dependency <name> --sites` (Counts each imported name, follows one hop through project wrappers, and counts each use that it cannot resolve.) |
| commit or open a PR | `pnpm exec fallow audit --base <ref>` |
| read a diff before approving it | `pnpm exec fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row) |
| prioritize refactoring | `pnpm exec fallow health --hotspots --targets` |
| ask who owns code | `pnpm exec fallow health --ownership` |
| check untested-but-reachable code | `pnpm exec fallow health --coverage-gaps` |
| improve or check the tests of a change | `pnpm exec fallow mutation --plan --base <ref>` (The plan runs no code. Without `--plan`, the command runs the project tests against each mutant, so ask the user first.) |
| consolidate duplication | `pnpm exec fallow dupes --trace dup:<fingerprint>` |
| find feature flags | `pnpm exec fallow flags` |
| check which architecture rules apply to a file before changing it | `pnpm exec fallow guard <files>` |
| check import cycles, boundaries and policy rules after changing code | `pnpm exec fallow architecture` |
| surface security candidates | `pnpm exec fallow security` |
| understand a finding | `pnpm exec fallow explain <issue-type>` |
| scope a monorepo | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command) |
