# @utilize/zod

[![npm version](https://img.shields.io/npm/v/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)

TypeScript/Zod code generator for JSON Schema. Converts a JSON Schema (with
references, `$defs` and `definitions`) into standalone Zod schemas and
TypeScript types.

## Features

- Generates standalone Zod schemas for the root and all definitions
- Infers TypeScript types from Zod schemas, including recursive ones
- Handles local, external, cyclic, `$id` and `$anchor` based `$ref`s
- Applies `$ref` siblings only in dialects that define them: 2019-09 and newer
  intersect them, draft-07 and older ignore them
- Validates `patternProperties`, including overlapping patterns and their
  interaction with `additionalProperties`
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
- `formatMode` — what `format` becomes in the generated code. `'annotate'`
  (default) keeps it as `.meta({ format })`, which is what JSON Schema asks for.
  `'assert'` turns known formats into validation (`.email()`, `.uuid()`,
  `.iso.datetime()`, …); unknown formats stay annotations in both modes.
- `formatMap` — map `format` names to your own Zod string expressions. An entry
  applies in both modes, so it is also a way to validate one format while
  leaving the others as annotations. Formats you do not list follow
  `formatMode`. `minLength`, `maxLength` and `pattern` are still appended:

  ```ts
  await compile({
  	input: './schema.json',
  	formatMap: {
  		'phone-number': String.raw`z.string().regex(/^\d{3}-\d{4}$/)`,
  		email: 'z.string().endsWith("@example.com")',
  	},
  });
  ```

- `customSchemaResolver(schema)` — return a Zod expression for a schema node,
  or `undefined` to let the generator handle it. It is called for every object
  node (including `$ref` nodes and the per-type copies of a `type` list, never
  boolean schemas) before `formatMap` and the built-in generators. The returned
  expression replaces the whole node: its `.meta()`, `.default()` and
  `.readonly()` are not added, while `.optional()` for a non-required property
  still is. Inside a recursive schema the hand-written value type types the
  node as `unknown`, because the generator cannot know your expression's type:

  ```ts
  await compile({
  	input: './schema.json',
  	customSchemaResolver: (schema) =>
  		schema.format === 'date-time' ? 'z.iso.datetime({ offset: true })' : undefined,
  });
  ```

- `runtimeImport` — module to import the `oneOfSchema` helper from, e.g.
  `'@utilize/zod/runtime'`. By default every generated file that needs the
  helper declares its own copy; with this option it imports the one exported
  by `@utilize/zod/runtime` (or your own module exporting `oneOfSchema`).
  `zod` must then be installed where the generated code runs, as usual. The
  specifier is written into every file unchanged, so a relative path only
  works for files in one directory; prefer a package name or path alias.
- `format(code)` — optional synchronous or asynchronous formatter (for example
  Prettier) applied to the generated code before the banner is prepended. Pass
  `false` or omit it to keep the generator output as-is.
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

`oneOf` becomes a plain `z.union()` when no value can match two branches:
different `const` or `enum` values, different types, or objects with a
different `const` on the same required property. Otherwise it uses the
`oneOfSchema` helper, which checks that exactly one branch matches (see
`runtimeImport`). An inline subschema that is identical to a standalone schema
is generated as a reference to it. An inline subschema with subschemas of its
own (properties, items, a combinator) that appears more than once without a
standalone schema is declared once and referenced wherever it appears. An
`anyOf` with a branch that accepts every
value, such as `anyOf: [X, {}]`, is left out: it never rejects a value, so
`.parse()` returns what the rest of the schema keeps.

## Naming

Each standalone schema gets the name resolved from `$id`, `title`, the `$defs`
key or the file name, and its type uses the same name. A repeated inline
subschema that is declared once is named by its `$id` or `title`, else after
the place it first appears, e.g. `TagsItem` for the items of a `tags` property;
names of standalone schemas take precedence, so it gets a numeric suffix when
its name is taken. `customNameResolver`, `schemaName` and `typeName` apply to it
like to any other declaration. Pass `schemaName` or
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
`.readonly()`, `--format-mode assert` to validate known formats, and
`--runtime-import @utilize/zod/runtime` to import the `oneOf` helper instead of
declaring it in every file.

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

Today it passes **262 of 269 draft-07 cases (925 of 939 assertions)**.
The 16 cases that need external schemas and the 19 tagged `format-assertion` are
not run: the default `formatMode` keeps `format` as an annotation.

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
