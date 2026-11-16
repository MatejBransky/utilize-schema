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

## Output

For each standalone schema (root, `$defs`, `definitions`, referenced):

```ts
export const MyType = Schema.Struct({ ... });
export type MyType = typeof MyType.Type;
```

References are always emitted as lazy schemas, so recursive and mutually
recursive definitions work without ordering constraints:

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

## Keyword coverage

Supported keywords:

- `type` (including unions of types), `const`, `enum`
- `string`: `minLength`, `maxLength`, `pattern`, `format` (annotation)
- `number`/`integer`: `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `multipleOf`
- `array`: `items`, `prefixItems`, `additionalItems`, `minItems`, `maxItems`,
  `uniqueItems`
- `object`: `properties`, `required`, `additionalProperties`, `propertyNames`,
  `minProperties`, `maxProperties`
- `allOf` between disjoint object subschemas, `anyOf`, `oneOf`
- `$ref`, `$defs`, `definitions`
- `title`, `description`, `default`, `examples`, `$id`, `readOnly`,
  `writeOnly` as annotations

Unsupported keywords throw `UnsupportedEffectSchemaFeatureError`: `not`,
`if`/`then`/`else`, `contains`, `minContains`, `maxContains`, `dependencies`,
`dependentRequired`, `dependentSchemas`, `patternProperties`,
`unevaluatedProperties`, `unevaluatedItems`, and a `$ref` combined with
constraint siblings.

Effect has no generic intersection or negation, so `allOf` is limited to
merging object subschemas that do not declare the same property.

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
