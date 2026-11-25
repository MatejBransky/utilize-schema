# Contributing to Utilize Schema

Thank you for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Getting Started

This repository requires Node.js 24 and pnpm 11. The exact pnpm version is
pinned in `package.json#packageManager`; Corepack can install it for you.

1. **Clone the repository:**

   ```sh
   git clone https://github.com/your-org/utilize-schema.git
   cd utilize-schema
   ```

2. **Install dependencies:**

   ```sh
   pnpm install
   ```

3. **Run the tests:**
   ```sh
   pnpm test
   ```

## Project Structure

- `packages/json-schema`: Core JSON Schema utilities and parser.
- `packages/zod`: Zod code generator and related logic.
- `packages/effect`: Effect Schema code generator and related logic.
- `packages/typescript`: TypeScript type generator (no runtime dependency).
- `playground`: Browser app for editing multi-file schemas and previewing the generated Zod, Effect Schema or TypeScript code.

Generators are pluggable: `packages/json-schema` owns parsing, linking and
normalization, and each target package only maps the parsed tree to its own
schema API. A new target follows the shape of `packages/typescript` — a
`generate` function that returns a module with one declaration per standalone
schema, plus a `compile` helper that reads a schema file and writes the
generated module. See the
[playground README](./playground/README.md#adding-a-generator) for the wiring a
target needs to show up in the UI.

## Playground previews

Only pull requests with the `Preview` label get a preview deployment of the
playground on Vercel. Add the label when a live preview is needed; every new
commit on that pull request refreshes the preview. Pull requests without the
label do not create a Vercel deployment. Production is deployed to GitHub Pages
from `main` by `.github/workflows/pages.yml`.

The project uses the **Root Directory** `playground` and
`playground/vercel.json`, so Vercel installs the pnpm workspace from the
repository root and then builds only the playground (`playground/dist`).
`git.deploymentEnabled: false` disables all automatic Vercel Git deployments,
including production, so they do not consume the Hobby plan's daily limit.
`.github/workflows/vercel-preview.yml` deploys labeled pull requests from the
same repository through the Vercel CLI instead.

Keep `vercel.json` inside the Root Directory: Vercel resolves its paths relative
to it, so a `vercel.json` at the repository root would point at
`playground/playground/dist` and fail with `STATIC_BUILD_NO_OUT_DIR`.

To set this up on a fork or a new repository:

1. Import the repository in Vercel and set the **Root Directory** to
   `playground`.
2. Keep the framework preset on Vite; `playground/vercel.json` supplies the
   build command and output directory.
3. Create a `Preview` label for pull requests that should get a preview.
4. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub Actions
   repository secrets. The token needs access to the Vercel project; the IDs
   are available in `.vercel/project.json` after running `vercel link` or in
   the Vercel dashboard.
5. Do not add a custom domain to preview deployments, so every preview keeps its
   own URL.

## Development Workflow

- Use [pnpm](https://pnpm.io/) for all scripts and dependency management.
- Make sure all tests pass before submitting a PR.
- Write or update tests for any new features or bug fixes.
- Use TypeScript and follow the existing code style (oxlint and oxfmt).

## What Fallow enforces here

Fallow checks unused code, dependency hygiene, duplication, import cycles,
complexity and package boundaries from one repository graph.

Run the changed-file audit before opening a PR:

```sh
pnpm fallow:audit
```

The audit uses `gate: new-only`, so existing complexity findings do not block a
change; findings introduced by the change do.

Install the optional local pre-commit hook:

```sh
pnpm hooks:install
```

It audits staged content against `HEAD`. `git commit --no-verify` is available
for a WIP commit that will be squashed, but it is not a way around a finding you
disagree with. Fix the code or update `.fallowrc.jsonc` with a documented reason.

The `Fallow audit` CI job runs on pull requests, uploads SARIF and fails on
introduced findings. A strict full-repository gate is intentionally not enabled
yet because the existing complexity backlog is still being reduced.

Regenerate and check the health badge with:

```sh
pnpm fallow:badge
pnpm check:fallow-badge
```

On every push to `main`, the `Fallow full repository` job runs all unit tests
with V8 coverage, merges their Istanbul data, and publishes `fallow health
--coverage --format github-summary` to the job summary. This gives CRAP scores
measured against real coverage instead of the static estimate used by the fast
PR audit and commit hook. It runs report-only until the measured backlog is
fully cleared; the strict main gate is enabled separately.

`rule-packs/utilize-policy.jsonc` keeps generator source browser-safe: `node:*`
imports are errors in the generator packages outside `compile.ts` and `cli.ts`.
Policy violations are errors in both the audit and the full run.

## Running Tests

- Run all tests:
  ```sh
  pnpm test
  ```
- Run tests in watch mode:
  ```sh
  pnpm test -- --watch
  ```
- Playground tests use two projects: most files run in Node, while React
  rendering and the Monaco TypeScript worker need a real browser. Install it
  once (the same headless shell CI uses):
  ```sh
  pnpm --filter playground exec playwright install --only-shell chromium
  ```
- Run the official JSON Schema Test Suite for the Zod generator:
  ```sh
  pnpm --filter @utilize/zod test:suite
  ```
- Run the official JSON Schema Test Suite for the Effect generator:
  ```sh
  pnpm --filter @utilize/effect test:suite
  ```
- Run it for the TypeScript generator (type-level, one `tsc` pass):
  ```sh
  pnpm --filter @utilize/typescript test:suite
  ```

## Coverage badge

Each package README shows a badge with the unit test line coverage of that
package's `src` folder, rounded down to a whole percent. The number includes
the JSON Schema Test Suite run and the thin `cli.ts` entry points. The badges
are SVG files in `.github/badges/`, committed to the repository.

CI runs `pnpm check:coverage-badge` and fails when a committed badge no longer
matches the measured value. To fix it, build the packages, regenerate the
badges and commit the result:

```sh
pnpm build:dev
pnpm badge:coverage
```

## Refactor benchmarks

Performance-sensitive refactors in `packages/json-schema` must include an A/B
benchmark in the pull request. Build the same benchmark entry at the baseline
and candidate commits, then compare the bundled production output in one Node
process:

```sh
# In the baseline checkout
pnpm --filter @utilize/json-schema bench:build

# In the candidate checkout
pnpm --filter @utilize/json-schema bench:build
BASELINE=/path/to/baseline/packages/json-schema/node_modules/.cache/utilize-bench/refactor.mjs
CANDIDATE="$PWD/packages/json-schema/node_modules/.cache/utilize-bench/refactor.mjs"
pnpm --filter @utilize/json-schema bench:compare "$BASELINE" "$CANDIDATE" prepare
```

The case is `prepare`, `index`, `external`, `link`, or `all`. The runner
alternates baseline and candidate samples, performs 2,000 measured iterations
after 300 warmup iterations, and fails when mean or median latency regresses by
more than 5%. Run it three times and include the results in the PR description.

When the baseline predates the harness, for example in the pull request that
introduces it, copy the harness files and `bench:build` / `bench:compare`
scripts from the candidate into the baseline checkout without changing its
`src/`. Build the copied entry against the baseline source, then compare it with
the candidate bundle.

## Dependency Versions

Shared dependencies are pinned once in the `catalog` section of `pnpm-workspace.yaml`.
Package manifests reference them with `"catalog:"` instead of a version range, so an upgrade
only changes the catalog entry. Use `pnpm add --save-catalog` for a new shared dependency.

## Code Style

- Format code with oxfmt:
  ```sh
  pnpm format
  ```
- Lint code with oxlint:
  ```sh
  pnpm check:lint
  ```

## Making a Pull Request

1. Fork the repository and create your branch from `main`.
2. Add your changes and tests.
3. Ensure all tests pass and code is formatted.
4. For a refactor, include three A/B benchmark runs and confirm there is no mean or median regression.
5. Open a pull request with a clear description of your changes.

## Reporting Issues

- Please include:
  - A clear description of the problem.
  - Steps to reproduce.
  - Example schema/code if possible.

## Feature Requests

- Open an issue describing your use case and proposed solution.
- If you want to implement it yourself, mention that in the issue.

## Contact

For questions, open an issue or start a discussion.

---

Thank you for helping make Utilize Schema better!
