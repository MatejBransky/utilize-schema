# Utilize Schema Monorepo

Generate robust, type-safe Zod or Effect Schema codecs and TypeScript types from JSON Schema — with first-class support for references, standalone definitions, and modern validation features.

---

## ✨ Features

- **Pluggable generators:** the parser is generator-agnostic, so a new target only needs a generator. `@utilize/zod` and `@utilize/effect` share the same pipeline.
- **$ref support:** Local, external, and cyclic references. Each generator picks its own strategy: Zod uses getters or typed `z.lazy()`, Effect Schema always emits `Schema.suspend`.
- **Standalone schema generation:** Every definition gets its own schema and type.
- **TypeScript-first:** Generates runtime schemas and TypeScript types, including recursive ones.
- **Draft support:** Draft-04/06/07, with normalization for 2019-09 and 2020-12.
- **Conformance:** the Zod generator is tested against the official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) — 233 of 271 draft-07 cases (1,323 of 1,605 assertions) pass today; remaining gaps are tracked per keyword.

---

## 📦 Packages

### [`@utilize/json-schema`](./packages/json-schema)

> Core utilities for resolving $refs and linking JSON Schema. Provides a generator-agnostic pipeline for schema transformation.

### [`@utilize/zod`](./packages/zod)

> Zod code generator. Walks the parsed JSON Schema and emits Zod schemas + TypeScript types.

### [`@utilize/effect`](./packages/effect)

> Effect Schema code generator. Walks the parsed JSON Schema and emits Effect Schema codecs + TypeScript types, with every `$ref` emitted through `Schema.suspend`.

---

```typescript
import { compile as compileZod } from '@utilize/zod';
import { compile as compileEffect } from '@utilize/effect';

await compileZod({
	input: './schema.json',
	output: './schema.zod.generated.ts',
});

await compileEffect({
	input: './schema.json',
	output: './schema.effect.generated.ts',
});
```

`@utilize/effect` requires `effect` as a peer dependency (`>=4.0.0 <5`):

```sh
pnpm add effect
```

## 🧪 Playground

The [`playground`](./playground) package is a browser app for editing multiple
JSON Schema files with references, switching between the Zod and Effect Schema
generators and watching the generated code and schema validation update live. It
is deployed to GitHub Pages:
<https://matejbransky.github.io/utilize-schema/>. Every pull request also gets a
Vercel preview deployment of the playground.

---

## Architecture

1. $ref resolver: resolves all $ref (local, external, cyclic)
2. linker: annotates each node with metadata (parent, referenced schema, path)
3. generator: one per target, emitting code and types for every standalone schema
4. target specifics: cycle handling and type inference differ per generator — Zod
   breaks cycles with getters/`z.lazy()` and derives value types, Effect Schema
   emits every reference through `Schema.suspend` and annotates only the schemas
   that take part in a cycle

---

## Supported features

Both generators accept the same input and are checked against each other by a
differential test suite (`packages/effect/test/parity.test.ts`), so the table
below is kept honest by CI. The Zod generator is also checked against the
official JSON Schema Test Suite for draft-07: **233 of 271 cases (1,323 of 1,605
assertions)** pass; the remaining gaps are listed in
`packages/zod/test/suite/knownFailures.ts`.

| JSON Schema Keyword                          | Zod | Effect Schema | Notes                                                                       |
| -------------------------------------------- | --- | ------------- | --------------------------------------------------------------------------- |
| `type`                                       | ✅  | ✅            | Full support, including unions of types                                     |
| `enum`                                       | ✅  | ✅            | Zod deep-equals composites; Effect supports primitives only                 |
| `const`                                      | ✅  | ✅            | Zod deep-equals composites; Effect supports primitives only                 |
| `default`                                    | ✅  | ✅            | Zod decodes with `.default()`; Effect stores it as an annotation            |
| `description` / `title` / `deprecated`       | ✅  | ✅            | Zod `.meta({})`, Effect `.annotate({})`                                     |
| `readOnly`                                   | ✅  | —             | Zod `.readonly()` with `readOnlyKeyword`; Effect keeps it as an annotation  |
| `minimum` / `maximum`                        | ✅  | ✅            | Supported                                                                   |
| `exclusiveMinimum` / `exclusiveMaximum`      | ✅  | ✅            | Supported (boolean draft-04 form included)                                  |
| `multipleOf`                                 | ✅  | ✅            | Supported                                                                   |
| `minLength` / `maxLength`                    | ✅  | ✅            | Effect counts code points, like JSON Schema                                 |
| `pattern`                                    | ✅  | ✅            | Zod `.regex()`, Effect `Schema.isPattern`                                   |
| `format`                                     | ✅  | —             | Zod validates known formats; Effect keeps it as an annotation               |
| `properties`                                 | ✅  | ✅            | Supported                                                                   |
| `required`                                   | ✅  | ✅            | Supported                                                                   |
| `additionalProperties`                       | ✅  | ✅            | Zod `z.strictObject`/`.catchall`, Effect keeps excess keys and filters them |
| `minProperties` / `maxProperties`            | ✅  | ✅            | Counted on the input, so undeclared keys count too                          |
| `patternProperties`                          | ❌  | ❌            | Not generated                                                               |
| `propertyNames`                              | ✅  | ✅            | Supported                                                                   |
| `items`                                      | ✅  | ✅            | Supported                                                                   |
| `prefixItems`                                | ✅  | ✅            | 2020-12 syntax, also via the tuple form of `items`                          |
| `additionalItems`                            | ✅  | ✅            | Supported                                                                   |
| `uniqueItems`                                | ✅  | ✅            | Key-order-insensitive comparison                                            |
| `contains`                                   | ✅  | ✅            | Supported                                                                   |
| `minContains` / `maxContains`                | ❌  | ❌            | Rejected instead of silently dropped                                        |
| `dependencies`                               | ✅  | ✅            | Also covers `dependentRequired` and `dependentSchemas`                      |
| `allOf`                                      | ✅  | ✅            | Zod intersects any schemas; Effect merges disjoint object subschemas        |
| `anyOf`                                      | ✅  | ✅            | Supported                                                                   |
| `oneOf`                                      | ✅  | ✅            | Zod requires exactly one match; Effect uses the exclusive union mode        |
| `not`                                        | ✅  | ✅            | Supported                                                                   |
| `if` / `then` / `else`                       | ✅  | ✅            | Supported                                                                   |
| `discriminator`                              | ✅  | —             | Zod emits a discriminated union; Effect ignores the annotation              |
| `$ref`                                       | ✅  | ✅            | Local, external and cyclic; boolean `true`/`false` targets supported        |
| `$defs` / `definitions`                      | ✅  | ✅            | Supported                                                                   |
| `$id`                                        | ✅  | ✅            | Kept as metadata                                                            |
| `examples`                                   | ✅  | ✅            | Kept as metadata                                                            |
| `$schema`                                    | ✅  | ✅            | Detects draft-04/06/07/2019-09/2020-12 and normalizes newer keywords        |
| `unevaluatedProperties` / `unevaluatedItems` | ✅  | ✅            | Mapped to `additionalProperties` / the items rest (best effort)             |

`✅` supported, `❌` rejected with a clear error, `—` accepted but only kept as
an annotation.

Schemas that omit `type` infer it from a single keyword family (object, array,
string or number), so constraints such as `{ pattern }` or `{ required }`
are not silently dropped.

2020-12 `prefixItems` maps to the tuple form of `items`, and
`dependentRequired`/`dependentSchemas` map to `dependencies`. `unevaluatedProperties`
and `unevaluatedItems` map to `additionalProperties` / the items rest when those
are not set, which covers schemas that do not rely on properties evaluated by
applicators. Unknown `$schema` values fall back to draft-07. 2019-09/2020-12
keywords without a generator (`$recursiveRef`, `$dynamicRef`, `minContains`,
`maxContains`) fail with `UnsupportedSchemaFeatureError`.

---

## 🔁 Recursive schemas

Both generators support self-referencing and mutually recursive schemas, but
they express the recursion differently.

**Zod** emits getters for recursion inside object properties:

```ts
type TreeValue = { name: string; children?: TreeValue[] };
export const Tree: z.ZodType<TreeValue> = z.object({
	name: z.string(),
	get children() {
		return z.array(Tree).optional();
	},
});
export type Tree = z.infer<typeof Tree>;
```

Cycles that cannot be deferred with a getter — array items, tuples, records and
recursive `additionalProperties` — are emitted as `z.lazy()` together with a
generated value type. A cycle that only passes through unions or aliases has no
value type TypeScript can express recursively, so generation fails with
`UnsupportedCyclicReferenceError` instead of emitting code that does not
type-check.

**Effect Schema** always emits references as lazy schemas, so no dependency
ordering is needed. Schemas that take part in a cycle get a value type and an
explicit annotation, because an inferred `typeof X.Type` would reference itself
and collapse to `any`:

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

---

## 🤔 Why Utilize Schema?

- **No more hand-written schemas:** Automate validation and types for Zod or Effect Schema.
- **Handles real-world schemas:** Works with complex, modular, and referenced schemas.
- **Pluggable targets:** The parser and linker are shared, so adding another target only means writing a generator.
- **Well-tested, well-documented:** Inspired by the best of open-source codegen tools.

---

## 🛠️ Contributing

- Clone the repo, run `pnpm install`
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for details
- Run tests: `pnpm test`

---

## 📄 License

MIT. See [LICENSE](./LICENSE).

---

## 🙏 Credits

Inspired by [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) and the Zod community.
