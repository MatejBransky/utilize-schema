# Reproduce

Reproduce a GitHub issue as a failing test in the repository. This is the only step that decides whether the rest of the pipeline runs.

**SCOPE: reproduction only.** Do not diagnose, verify, or fix. Do not spawn subagents. Always write `report.md`, even when you skip or fail.

## Prerequisites

- `triageDir` — default `triage/gh-<issueNumber>`.
- `issueDetails` — title, body, labels, comments. If missing, run `gh issue view <issueNumber> --comments`.
- The workspace is installed and built. The workflow runs `pnpm install --frozen-lockfile` and `pnpm build:dev` before this skill.

## Step 1: Read the report

Extract:

- the package and generator (`json-schema`, `zod`, `effect`, `typescript`, `playground`);
- the smallest schema and the options (`formatMode`, `runtimeImport`, `dialect`, custom resolver);
- expected output and actual output;
- the `@utilize/*` version and Node version.

If the report names a version older than the current `main`, reproduce against the checked-out `main` first. If it does not reproduce there, exit with `unsupported-version` and say that the fix is already on `main`.

## Step 2: Check for early exits

- **`not-actionable`** — feature request, question, or no expected behavior.
- **`missing-details`** — no schema, no reproduction, or no expected result.
- **`host-specific`** — browser-only playground bug that cannot be expressed as a unit test.
- **`unsupported-runtime`** — Bun or Deno only.
- **`maintainer-override`** — a maintainer asked to stop.

If you exit, write `report.md` with the reason and return `{ reproducible: false, skipped: true, skippedReason: "<reason>" }`. Do not guess a reproduction.

## Step 3: Map the symptom to a package

| Symptom                                                                 | Package                  | Start here                                                        |
| ----------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| Wrong `$ref` resolution, external refs, cycles, dialect selection, warnings | `@utilize/json-schema`   | `packages/json-schema/src/{parser,linker,normalize,dialect,keywords}.ts` |
| Wrong Zod code, runtime parse result, `.default()`, `__proto__`, formats | `@utilize/zod`           | `packages/zod/src/{generator,generators/*,refinements}.ts`          |
| Wrong Effect code, decode result, `Schema.suspend`, parity with Zod      | `@utilize/effect`        | `packages/effect/src/{generator,generators/*}.ts`                  |
| Wrong emitted types, recursive interfaces, index signatures              | `@utilize/typescript`    | `packages/typescript/src/{generator,generators/*}.ts`              |
| Editor, layout, Monaco, file tree                                       | `playground`             | Only if a unit test can capture it; otherwise `host-specific`      |

When the parser or linker is at fault, the bug usually affects more than one generator. Reproduce it on the shared layer, then check the other generators in `diagnose`.

## Step 4: Write the reproduction as a test

Create `packages/<pkg>/test/triage/issue-<number>.test.ts`. Keeping it inside the package means the existing `vitest.config.ts`, `setup.ts`, and `test-utils.ts` apply, and no lockfile or workspace change is needed.

Use the existing helpers instead of hand-rolling generation:

### Zod

```ts
import { describe, expect, test } from 'vitest';

import { compileToZod } from '../test-utils';

describe('issue #<number>', () => {
	test('reproduces the reported behavior', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { value: { type: 'string' } },
		});

		expect(Root.safeParse({ value: 1 }).success).toBe(false);
	});
});
```

For generated-code assertions use `compile` and `toMatchCode` (see `packages/zod/test/setup.ts` and a codegen test such as `string.test.ts`). For runtime behavior use `compileToZod` / `compileModule` (see `runtime.test.ts`).

### Effect

```ts
import { describe, expect, test } from 'vitest';

import { compileToSchema, decode } from '../test-utils';

describe('issue #<number>', () => {
	test('reproduces the reported behavior', async () => {
		const Root = await compileToSchema({ type: 'object', properties: { value: { type: 'string' } } });

		expect(decode(Root, { value: 1 })).toBeUndefined();
	});
});
```

### TypeScript

`compile` returns the emitted source; assert on it with `toMatchCode` or `toContain`. For type-level bugs, copy the `tsc` harness from `packages/typescript/test/typecheck.test.ts` (`typeCheck` at the bottom of the file): write the generated files to a temp directory and run `tsc --noEmit --strict --skipLibCheck`.

### JSON Schema parser and dialect

```ts
import { describe, expect, test } from 'vitest';

import { parse } from '../../src';

describe('issue #<number>', () => {
	test('reproduces the reported behavior', async () => {
		const parsed = await parse(
			{ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string' },
			{ cwd: __dirname, fileName: 'Root.json' }
		);

		expect(parsed.root).toBeDefined();
	});
});
```

For dialect warnings, collect `onDialectIssue` and assert the `kind`, `keyword`, `dialect`, and `path`. See `packages/json-schema/test/dialect.test.ts`.

## Step 5: Run the test and verify the baseline

```sh
pnpm --filter @utilize/<pkg> exec vitest run test/triage/issue-<number>.test.ts
```

The test must **fail for the reported reason** on the current `main`. If it passes, the bug is not reproduced: your fixture is wrong, the version is already fixed, or the report is about a different layer. Check the baseline by simplifying the schema and confirming the test flips.

Do not add debug output to committed files. Use `console.log` only inside the temporary test, and remove it before finishing.

## Step 6: Write `report.md`

Write `triage/gh-<issueNumber>/report.md` with:

- the issue title, body, and relevant comments;
- package, version, Node version, and generator options;
- the minimal schema and the exact command;
- expected vs actual (full output, error, stack trace);
- the test path and whether it fails on `main`;
- anything that would help `diagnose.md` work faster.

Be verbose. Downstream steps do not have the issue in front of them; `report.md` is their only context.

## Output

Return `{ reproducible: true, skipped: false, skippedReason: null }` when the failing test is in place. If the test passes or the issue is out of scope, return `{ reproducible: false, skipped: <true|false>, skippedReason: <reason|null> }` and explain in `report.md`.
