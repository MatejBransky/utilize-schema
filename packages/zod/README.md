# @utilize/zod

[![npm version](https://img.shields.io/npm/v/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
[![Unit test coverage](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/coverage-zod.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/CONTRIBUTING.md#coverage-badge)

[![draft-04 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-zod-draft-04.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/zod/README.md#conformance)
[![draft-06 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-zod-draft-06.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/zod/README.md#conformance)
[![draft-07 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-zod-draft-07.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/zod/README.md#conformance)
[![2019-09 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-zod-2019-09.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/zod/README.md#conformance)
[![2020-12 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-zod-2020-12.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/zod/README.md#conformance)

Zod schemas and TypeScript types from JSON Schema, including `$ref`s, cycles and
modular `$defs`. Every definition becomes a standalone schema, and the generated
file imports `zod`.

- **Standalone output.** One schema per root, `$defs` and `definitions` entry,
  topologically sorted, each with its `z.infer` type.
- **Cycles handled.** Getters for object properties, typed `z.lazy()` where a
  getter cannot defer the reference.
- **Five dialects.** draft-04, draft-06, draft-07, 2019-09 and 2020-12;
  `$ref` siblings apply only where the dialect defines them.
- **100% of the official suite in all five dialects.** 1,609 of 1,609 cases;
  96% line coverage.

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    }
  },
  "required": ["id"]
}
```

```ts
export const User = z.object({ id: z.uuid().meta({ format: 'uuid' }) });
export type User = z.infer<typeof User>;
```

The UUID format keeps this example short. Formats that need structural
validation, such as `email`, `hostname` and `uri`, emit one validator constant
per format, shared by every schema that uses it.

```sh
pnpm add zod
pnpm add -D @utilize/zod
utilize-zod user.json user.zod.ts
```

`zod` 4.5 or newer is required. Try it in the
[playground](https://matejbransky.github.io/utilize-schema/?generator=zod): open
an example, switch between the three generators, and check how a test document
validates against the generated schema.

<details>
<summary>Table of contents</summary>

- [Usage](#usage)
- [Options](#options)
- [Output](#output)
- [Naming](#naming)
- [How it works](#how-it-works)
- [CLI](#cli)
- [Conformance](#conformance)
- [Testing](#testing)

</details>

## Usage

```ts
import { compile } from '@utilize/zod';

await compile({
  input: './schema.json',
  output: './schema.generated.ts',
});
```

## Options

`compile()` accepts the following options:

- `customNameResolver(schema, usedNames)` — override the name allocated for a
  standalone schema.
- `readOnlyKeyword` — map `readOnly: true` to `.readonly()`. Off by default,
  because it freezes values and changes the inferred type.
- `formatMode` — what `format` becomes in the generated code. `'assert'`
  (default) turns known formats into validation (`.uuid()`, `.iso.date()`,
  RFC 3339 date-time and URI validators, …); `'annotate'` keeps `format` as
  `.meta({ format })`. Unknown formats stay annotations in both modes. A format
  that needs structural validation becomes one module-level validator reused by
  every property that uses it. Validation follows the JSON Schema format
  definitions, so `time` requires an RFC 3339 offset and `uri`, `email` and
  `hostname` are stricter than their target helpers.
- `formatMap` — map `format` names to your own Zod string expressions. An entry
  applies in both modes, so it can validate a format that `formatMode` would
  leave as an annotation. Formats you do not list follow `formatMode`.
  `minLength`, `maxLength` and `pattern` are still appended:

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
- `externalSchemas` — documents served for absolute `$ref` URIs, keyed by
  retrieval URI. A URI present here is read from memory instead of disk or the
  network. Identifiers declared inside a document (`$id`, or the draft-04 `id`)
  are served too.

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

### `__proto__` properties

A `__proto__` property in your schema is validated as an own property of the
input: `required` and its value schema are enforced, also for `const` and `enum`
values and for `additionalProperties`. The parsed output does not contain it,
because Zod drops `__proto__` from parsed objects and records on purpose. Do
not read a `__proto__` value from the result of `.parse()`; read it from the
input you passed in.

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
`.readonly()`, and `--runtime-import @utilize/zod/runtime` to import the
`oneOf` helper instead of declaring it in every file.

## Conformance

The official JSON Schema Test Suite is pinned and run for all five dialects. The
badges link here:

| Dialect  | Cases passing | Where the gaps are |
| -------- | ------------- | ------------------ |
| draft-04 | 194 / 194     | —                  |
| draft-06 | 263 / 263     | —                  |
| draft-07 | 304 / 304     | —                  |
| 2019-09  | 417 / 417     | —                  |
| 2020-12  | 431 / 431     | —                  |

Which keywords are implemented, and which are only kept as annotations, is in
[docs/keywords.md](../../docs/keywords.md#runtime-generators). Every dialect is
pinned case by case in `knownFailuresByDialect.ts`. Draft-07 has no known gaps;
`knownFailures.ts` and `knownFailureInstances.ts` remain the place to record
one.

## Testing

```sh
pnpm test          # unit tests
pnpm test:suite    # official JSON Schema Test Suite (all dialects)
```

The generator is checked against the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).
The suite is pinned to a commit and installed as a dev dependency. Each test
case is compiled to a Zod schema in memory and every instance from the suite is
run through `safeParse`.

All five dialects are measured: draft-04, draft-06, draft-07, 2019-09 and
2020-12. Every dialect is pinned case by case in `knownFailuresByDialect.ts`.
`test/suite/baseline.ts` records the counts the badges render.

Today it passes **every case and assertion in all five dialects**: draft-04
(194/194 cases, 911/911 assertions), draft-06 (263/263, 1,218/1,218), draft-07
(304/304, 1,655/1,655), 2019-09 (417/417, 2,043/2,043) and 2020-12 (431/431,
2,082/2,082). Format cases run in the mode they are tagged for, so both the
annotation and the assertion cases are measured.

There are no known gaps. A future gap is recorded in
`test/suite/knownFailures.ts`, together with its exact failing instances in
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
