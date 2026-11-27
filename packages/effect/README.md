# @utilize/effect

[![npm version](https://img.shields.io/npm/v/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
[![Unit test coverage](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/coverage-effect.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/CONTRIBUTING.md#coverage-badge)

[![draft-04 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-effect-draft-04.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/effect/README.md#conformance)
[![draft-06 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-effect-draft-06.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/effect/README.md#conformance)
[![draft-07 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-effect-draft-07.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/effect/README.md#conformance)
[![2019-09 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-effect-2019-09.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/effect/README.md#conformance)
[![2020-12 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-effect-2020-12.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/effect/README.md#conformance)

Effect Schema codecs and TypeScript types from JSON Schema. Every `$ref`,
including cycles, goes through `Schema.suspend`, so the generated module needs no
dependency ordering and imports `effect`.

- **Standalone codecs.** One exported const and one `typeof X.Type` per root,
  `$defs` and `definitions` entry.
- **Mapped or rejected, never ignored.** Unsupported constructs fail with
  `UnsupportedEffectSchemaFeatureError` instead of disappearing.
- **Five dialects.** draft-04, draft-06, draft-07, 2019-09 and 2020-12.
- **100% of the official draft-07 suite.** 304 of 304 cases; 95% line coverage.

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    }
  },
  "required": ["name"]
}
```

```ts
export const User = Schema.StructWithRest(
  Schema.Struct({ name: Schema.String }),
  [Schema.Record(Schema.String, Schema.Json)]
);
export type User = typeof User.Type;
```

```sh
pnpm add effect @utilize/json-schema
pnpm add -D @utilize/effect
utilize-effect user.json user.effect.ts
```

Structural formats such as `email` and `uri` are imported from
`@utilize/json-schema/formats`, so that package is needed at runtime too.

`effect` 4.x is required. Try it in the
[playground](https://matejbransky.github.io/utilize-schema/?generator=effect):
open an example, switch between the three generators, and check how a test
document validates against the generated schema.

<details>
<summary>Table of contents</summary>

- [Usage](#usage)
- [CLI](#cli)
- [Output](#output)
- [Conformance](#conformance)
- [Testing](#testing)
- [Keyword coverage](#keyword-coverage)
- [Notes](#notes)

</details>

## Usage

```ts
import { compile } from '@utilize/effect';

await compile({
  input: './schema.json',
  output: './schema.generated.ts',
});
```

`compile()` accepts JSON or YAML input and writes a "do not edit" banner by
default (`bannerComment: false` to omit it). `compileFile()` and
`compileSchema()` return the generated code without writing anything.

Options:

- `customNameResolver(schema, usedNames)` — override the name allocated for a
  standalone schema.
- `externalSchemas` — documents served for absolute `$ref` URIs, keyed by
  retrieval URI. A URI present here is read from memory instead of disk or the
  network.
- `customSchemaResolver(schema)` — return an Effect Schema expression for a
  schema node, or `undefined` to let the generator handle it. It is called for
  every object node (including `$ref` nodes and the per-type copies of a `type`
  list, never boolean schemas) before the built-in generator, so it can also
  replace a node the generator rejects, such as an `allOf` of non-object
  schemas. Keywords the parser rejects never reach it. The returned
  expression replaces the whole node, including its `.annotate({ … })`, while
  `Schema.optionalKey` for a non-required property is still added. Inside a
  recursive schema the value type types the node as `unknown`, because the
  generator cannot know your expression's type.
- `formatMode` — what `format` becomes in the generated code. `'assert'`
  (default) adds a check for the formats the generator knows (email, uuid, url,
  ipv4/ipv6, date, date-time, duration, …); `'annotate'` keeps `format` as
  `.annotate({ format })`. Unknown formats stay annotations in both modes. A
  format that needs structural validation is imported once from
  `@utilize/json-schema/formats` (`formatEmail`, `formatUri`, …) and reused by
  every property that uses it. Validation follows the JSON Schema format
  definitions, so `time` requires an RFC 3339 offset and `uri`, `email` and
  `hostname` are stricter than their target helpers.
- `format(code)` — optional synchronous or asynchronous formatter (for example
  Prettier) applied to the generated code before the banner is prepended.
- `importEffect` — emit `import { Schema } from 'effect';`; on by default.

## CLI

```sh
utilize-effect schema.json schema.generated.ts
utilize-effect --input 'schemas/**/*.json' --output generated/
cat schema.yaml | utilize-effect > schema.generated.ts
```

Input can be a file, a directory or a glob; JSON and YAML are supported. Output
defaults to stdout. Every generated file starts with a "do not edit" banner
(`--no-banner` omits it).

## Output

For each standalone schema (root, `$defs`, `definitions`, referenced):

```ts
export const MyType = Schema.Struct({ ... });
export type MyType = typeof MyType.Type;
```

Recursive schemas get a value type and an explicit annotation, because an
inferred `typeof X.Type` would reference itself and collapse to `any`:

```ts
type TreeValue = { name: string; children?: ReadonlyArray<TreeValue> };

export const Tree: Schema.Codec<TreeValue> = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.String,
    children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Tree))),
  }),
  [Schema.Record(Schema.String, Schema.Json)]
);

export type Tree = typeof Tree.Type;
```

References are always emitted as lazy schemas, so recursive and mutually
recursive definitions work without ordering constraints. A `$ref` to a boolean
schema emits `Schema.Json` or `Schema.Never` directly.

```ts
export const Tree = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.String,
    children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Tree))),
  }),
  [Schema.Record(Schema.String, Schema.Json)]
);

export type Tree = typeof Tree.Type;
```

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
export const PersonSchema = Schema.Struct({ ... });
export type PersonSchema = typeof PersonSchema.Type;
```

The callbacks are independent and default to the resolved name, so mapping only
`schemaName` keeps the type at `Person`:

```ts
export const PersonSchema = Schema.Struct({ ... });
export type Person = typeof PersonSchema.Type;
```

A mapped name that is already a valid identifier is used as it is, so a
callback can pick its own casing, e.g. `personSchema`. Anything else is turned
into an identifier. Names are mapped only once every schema's name is resolved,
and schema variables and types are kept unique separately, so a mapped name
never takes the name of another schema. Every `$ref` points at the renamed
variable. The option belongs to the generator instead of the shared parser,
because a target that emits only types has no schema variable to name.

## Conformance

The official JSON Schema Test Suite is pinned and run for all five dialects. The
badges link here:

| Dialect  | Cases passing | Where the gaps are                                |
| -------- | ------------- | ------------------------------------------------- |
| draft-04 | 194 / 194     | —                                                 |
| draft-06 | 263 / 263     | —                                                 |
| draft-07 | 304 / 304     | —                                                 |
| 2019-09  | 375 / 417     | [case list](test/suite/knownFailuresByDialect.ts) |
| 2020-12  | 374 / 431     | [case list](test/suite/knownFailuresByDialect.ts) |

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
All five dialects are measured: draft-04, draft-06, draft-07, 2019-09 and
2020-12. Every dialect is pinned case by case in `knownFailuresByDialect.ts`.
`test/suite/baseline.ts` records the counts the badges render.

Today it passes **1,510 of 1,609 cases** across the five dialects, including every
draft-04, draft-06 and draft-07 case. Format cases run in the mode they are tagged
for, so both the annotation and the assertion cases are measured; cases that need
external schemas are served from `externalSchemas`. The remaining 2019-09 and
2020-12 gaps are dynamic/recursive references, full `unevaluated*` annotation
propagation, and a few vocabulary/annotation cases.

Draft-07 has no known gaps. A future gap is recorded in
`test/suite/knownFailures.ts` and `test/suite/knownFailureInstances.ts`. Refresh
the baseline after a fix or a regression:

```sh
pnpm --filter @utilize/effect build
pnpm --filter @utilize/effect update:suite-baseline
```

The script reads the built `dist/`, so build the package first.

## Keyword coverage

Effect Schema covers the same keywords as the Zod generator, with a few
constructs emitted as `Schema.makeFilter` checks. The full table and the
Effect-specific notes are in
[docs/keywords.md](../../docs/keywords.md#effect-schema-specifics).

## Notes

- Optional properties use `Schema.optionalKey`, so a missing key stays missing
  instead of decoding to `undefined`.
- Objects are emitted as
  `Schema.StructWithRest(..., [Schema.Record(String, Json)])` so excess keys
  are preserved like JSON Schema does, and then filtered when the schema is
  closed or declares a typed `additionalProperties`.
- Metadata and defaults are attached with `.annotate(...)`, so they never
  change decoding.
