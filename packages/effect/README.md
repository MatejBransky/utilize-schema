# @utilize/effect

[![npm version](https://img.shields.io/npm/v/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)

TypeScript/Effect Schema code generator for JSON Schema. Converts a JSON Schema
(with references, `$defs` and `definitions`) into standalone Effect Schema
codecs and TypeScript types.

## Features

- Generates standalone Effect schemas for the root and all definitions
- Emits one exported const and one exported `typeof X.Type` per schema
- Handles local, external, cyclic, `$id` and `$anchor` based `$ref`s through
  `Schema.suspend`, so no topological sort is needed
- Maps scalar, array, object, pattern properties, and composition keywords to
  Effect Schema constructs and checks
- Rejects JSON Schema features that have no Effect Schema equivalent instead of
  silently ignoring them

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
  `.annotate({ format })`. Unknown formats stay annotations in both modes. Each
  format becomes one module-level constant (`const formatEmail = …`) reused by
  every property that uses it.
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

## Testing

```sh
pnpm test          # unit tests
pnpm test:suite    # official JSON Schema Test Suite (draft-07)
```

The generator is checked against the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).
Today it passes **229 of 304 draft-07 cases (1,274 of 1,655 assertions)**. Format
cases run in the mode they are tagged for, so both the annotation and the
assertion cases are measured; cases that need external schemas are served from
`externalSchemas`.

Known gaps live in `test/suite/knownFailures.ts` and
`test/suite/knownFailureInstances.ts`. Refresh the baseline after a fix or a
regression:

```sh
pnpm --filter @utilize/effect build
pnpm --filter @utilize/effect update:suite-baseline
```

The script reads the built `dist/`, so build the package first.

## Keyword coverage

Supported keywords:

- `type` (including unions of types), `const`, `enum` (primitives only for `const`/`enum`)
- `string`: `minLength`, `maxLength`, `pattern`, `format` (checked by default, annotation with `formatMode: 'annotate'`)
- `number`/`integer`: `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `multipleOf`
- `array`: `items`, `prefixItems`, `additionalItems`, `minItems`, `maxItems`,
  `uniqueItems`
- `object`: `properties`, `patternProperties`, `required`,
  `additionalProperties`, `propertyNames`, `minProperties`, `maxProperties`
- `allOf` between disjoint object subschemas, `anyOf`, `oneOf`
- `not`, `if`/`then`/`else`, `contains`, `dependencies` (applied as filters)
- `$ref`, `$defs`, `definitions`
- `title`, `description`, `default`, `examples`, `$id`, `readOnly`,
  `writeOnly`, `deprecated` as annotations

Effect has no schema constructor for negation, conditionals or "contains", so
`not`, `if`/`then`/`else`, `contains` and `dependencies` are emitted as
`Schema.makeFilter` checks that evaluate the subschemas with `Schema.is`.
`dependentRequired` and `dependentSchemas` are normalized to `dependencies`
before generation.

`unevaluatedProperties` and `unevaluatedItems` are normalized to
`additionalProperties` and the items rest before generation, as a best effort
for schemas that do not rely on properties evaluated by applicators.

Unsupported keywords throw `UnsupportedEffectSchemaFeatureError`:
`minContains`, `maxContains`.

`$ref` siblings follow the dialect: draft-07 and older ignore them, 2019-09 and
newer merge disjoint object siblings into one struct. Other siblings (a
non-object or recursive target, `not`, `if`, ...) are checked with a filter on
the reference, which keeps the reference's type.

Effect has no generic intersection, so `allOf` is limited to merging object
subschemas that do not declare the same property.

## Notes

- Optional properties use `Schema.optionalKey`, so a missing key stays missing
  instead of decoding to `undefined`.
- Objects are emitted as
  `Schema.StructWithRest(..., [Schema.Record(String, Json)])` so excess keys
  are preserved like JSON Schema does, and then filtered when the schema is
  closed or declares a typed `additionalProperties`.
- Metadata and defaults are attached with `.annotate(...)`, so they never
  change decoding.

## When to use

Use this package to generate Effect Schema codecs and TypeScript types from
JSON Schema, including complex schemas with references and modular structure.
