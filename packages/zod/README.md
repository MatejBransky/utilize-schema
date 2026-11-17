# @utilize/zod

TypeScript/Zod code generator for JSON Schema. Converts a JSON Schema (with
references, `$defs` and `definitions`) into standalone Zod schemas and
TypeScript types.

## Features

- Generates standalone Zod schemas for the root and all definitions
- Infers TypeScript types from Zod schemas, including recursive ones
- Handles local, external, and cyclic `$ref`s
- Emits getters or typed `z.lazy()` for recursive schemas
- Topologically sorts schemas by dependency
- Supports most of JSON Schema Draft 7 (see the root README for keyword
  coverage)

## Usage

```ts
import { compile } from '@utilize/zod';

await compile({
	input: './schema.json',
	output: './schema.generated.ts',
});
```

## Output

For each standalone schema (root, `$defs`, `definitions`, referenced):

```ts
export const MyType = z.object({ ... });
export type MyType = z.infer<typeof MyType>;
```

Recursive schemas are annotated so TypeScript can infer them:

```ts
type TreeValue = { children?: TreeValue[] };
export const Tree: z.ZodType<TreeValue> = z.object({
	get children() {
		return z.array(Tree).optional();
	},
});
export type Tree = z.infer<typeof Tree>;
```

The generated `Value` alias is internal; use the exported type in your own
code.

## How it works

- Collects all standalone schemas (root, `$defs`, `definitions`, referenced)
- Builds the dependency graph and breaks `$ref` cycles at object properties
  (getters) or with `z.lazy()`
- Derives value types for recursive schemas and annotates them as
  `z.ZodType<Value>`
- Sorts schemas so the generated file initializes in dependency order
- Selects the right generator for each schema node
- Emits Zod code and inferred types

## Testing

```sh
pnpm test          # unit tests
pnpm test:suite    # official JSON Schema Test Suite (draft-07)
```

The generator is checked against the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).
The suite is pinned to a commit and installed as a dev dependency. Each test
case is compiled to a Zod schema in memory and every instance from the suite is
run through `safeParse`.

Today it passes **213 of 271 draft-07 cases (1,299 of 1,605 assertions)**.

Cases the generator does not handle yet are listed in
`test/suite/knownFailures.ts`, together with the exact instances that fail in
`test/suite/knownFailureInstances.ts`. A fix or a regression changes that set,
so the suite fails and the baseline has to be refreshed:

```sh
pnpm --filter @utilize/zod update:suite-baseline
```

Review the diff: a shrinking set is progress, a growing one is a regression.
The runner prints the current totals at the end of every run.

## When to use

Use this package to automate Zod schema and TypeScript type generation from
JSON Schema, including complex schemas with references and modular structure.
