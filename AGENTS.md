# Agent notes

## ui-sdk

This project uses [ui-sdk](https://ui-sdk.dev/) via `@ui-sdk/react` and
`@ui-sdk/core` in the `playground` app.

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read
`node_modules/@ui-sdk/react/docs/llms.txt` (in this pnpm workspace:
`playground/node_modules/@ui-sdk/react/docs/llms.txt`). To build a new
component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading and
read `rendering.md` next to it.

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
