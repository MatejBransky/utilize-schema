# @utilize/effect

TypeScript/Effect Schema code generator for JSON Schema. Converts a JSON Schema
(with references, `$defs` and `definitions`) into standalone Effect Schema
codecs and TypeScript types.

## Features

- Generates standalone Effect schemas for the root and all definitions
- Emits one exported const and one exported `typeof X.Type` per schema
- Handles local, external, and cyclic `$ref`s through `Schema.suspend`, so no
  topological sort is needed
- Maps scalar, array, object, and composition keywords to Effect Schema
  constructs and checks
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

Mapped names are sanitized into valid identifiers and kept unique, and every
`$ref` suspends the renamed variable. The option belongs to the generator
instead of the shared parser, because a target that emits only types has no
schema variable to name.

## Testing

```sh
pnpm test          # unit tests
pnpm test:suite    # official JSON Schema Test Suite (draft-07)
```

The generator is checked against the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).
Today it passes **204 of 269 draft-07 cases (774 of 939 assertions)**. Cases
tagged `format-assertion` are skipped because `format` is kept as an annotation;
cases that need external schemas are not wired up yet.

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
- `string`: `minLength`, `maxLength`, `pattern`, `format` (annotation)
- `number`/`integer`: `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `multipleOf`
- `array`: `items`, `prefixItems`, `additionalItems`, `minItems`, `maxItems`,
  `uniqueItems`
- `object`: `properties`, `required`, `additionalProperties`, `propertyNames`,
  `minProperties`, `maxProperties`
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
`patternProperties`, `minContains`, `maxContains`, and a `$ref` combined with
constraint siblings.

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
