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

`@utilize/zod` requires `zod` 4 as a peer dependency:

```sh
pnpm add zod
```

## Options

`compile()` accepts the following options:

- `customNameResolver(schema, usedNames)` — override the name allocated for a
  standalone schema.
- `readOnlyKeyword` — map `readOnly: true` to `.readonly()`. Off by default,
  because it freezes values and changes the inferred type.
- `bannerComment` — header prepended to written files; `false` disables it.

For custom pipelines, `compileFile()` and `compileSchema()` return the generated
code without writing anything, and `withBanner()` applies the default header.

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

## Naming

Each standalone schema gets the name resolved from `$id`, `title`, the `$defs`
key or the file name, and its type uses the same name. Pass `schemaName` or
`typeName` to rewrite one of them. Both callbacks receive the resolved name, so
a suffix only has to describe the difference:

```ts
await compile({
	input: './schema.json',
	output: './schema.generated.ts',
	schemaName: (name) => `${name}Schema`,
	typeName: (name) => `${name}Schema`,
});
```

```ts
export const PersonSchema = z.object({ ... });
export type PersonSchema = z.infer<typeof PersonSchema>;
```

The callbacks are independent and default to the resolved name, so mapping only
`schemaName` keeps the type at `Person`:

```ts
export const PersonSchema = z.object({ ... });
export type Person = z.infer<typeof PersonSchema>;
```

A mapped name that is already a valid identifier is used as it is, so a
callback can pick its own casing, e.g. `personSchema`. Anything else is turned
into an identifier. Names are mapped only once every schema's name is resolved,
and schema variables and types are kept unique separately, so a mapped name
never takes the name of another schema. `$ref`s point at the renamed variable.
The option belongs to the generator instead of the shared parser, because a
target that emits only types has no schema variable to name.

## How it works

- Collects all standalone schemas (root, `$defs`, `definitions`, referenced)
- Builds the dependency graph and breaks `$ref` cycles at object properties
  (getters) or with `z.lazy()`
- Derives value types for recursive schemas and annotates them as
  `z.ZodType<Value>`
- Sorts schemas so the generated file initializes in dependency order
- Selects the right generator for each schema node
- Emits Zod code and inferred types

## CLI

```sh
utilize-zod schema.json schema.generated.ts
utilize-zod --input 'schemas/**/*.json' --output generated/
cat schema.yaml | utilize-zod > schema.generated.ts
```

Input can be a file, a directory or a glob; JSON and YAML are supported. Output
defaults to stdout. Every generated file starts with a "do not edit" banner
(`--no-banner` omits it). Pass `--readonly` to map `readOnly: true` to
`.readonly()`.

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

Today it passes **233 of 271 draft-07 cases (1,323 of 1,605 assertions)**.

Cases the generator does not handle yet are listed in
`test/suite/knownFailures.ts`, together with the exact instances that fail in
`test/suite/knownFailureInstances.ts`. A fix or a regression changes that set,
so the suite fails and the baseline has to be refreshed:

```sh
pnpm --filter @utilize/zod build
pnpm --filter @utilize/zod update:suite-baseline
```

The script reads the built `dist/`, so build the package first.

Review the diff: a shrinking set is progress, a growing one is a regression.
The runner prints the current totals at the end of every run.

See [`docs/conformance.md`](../../docs/conformance.md) for how these numbers
relate to json-schema-to-typescript.

## When to use

Use this package to automate Zod schema and TypeScript type generation from
JSON Schema, including complex schemas with references and modular structure.
