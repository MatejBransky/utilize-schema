# Utilize Schema Monorepo

Generate robust, type-safe Zod or Effect Schema codecs — or plain TypeScript types — from JSON Schema, with first-class support for references, standalone definitions, and modern validation features.

[![Check](https://img.shields.io/github/actions/workflow/status/MatejBransky/utilize-schema/check.yml?branch=main&label=check)](https://github.com/MatejBransky/utilize-schema/actions/workflows/check.yml)
[![License](https://img.shields.io/github/license/MatejBransky/utilize-schema)](./LICENSE)

---

## ✨ Features

- **Pluggable generators:** the parser is generator-agnostic, so a new target only needs a generator. `@utilize/zod`, `@utilize/effect` and `@utilize/typescript` share the same pipeline.
- **$ref support:** Local, external, and cyclic references. Each generator picks its own strategy: Zod uses getters or typed `z.lazy()`, Effect Schema always emits `Schema.suspend`, and the TypeScript generator emits recursive interfaces.
- **Standalone schema generation:** Every definition gets its own schema or type.
- **Configurable names:** rewrite generated Zod and Effect schema variables and types
  with a callback, e.g. to suffix schemas with `Schema`.
- **TypeScript-first:** Generates runtime schemas and TypeScript types, including recursive ones. `@utilize/typescript` emits the types alone, with no runtime dependency.
- **Draft support:** Draft-04/06/07, with normalization for 2019-09 and 2020-12.
- **Conformance:** all generators are tested against the official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) for draft-07 — Zod passes 262 of 269 cases (925 of 939 assertions), Effect Schema 214 of 269 cases (818 of 939 assertions), and TypeScript 175 of 269 cases at the type level; remaining gaps are tracked per keyword.
- **Format is a choice:** both runtime generators keep `format` as metadata by default and validate known formats with `formatMode: 'assert'`. `formatMap` overrides individual formats.
- **Dialect-aware:** `$schema` is resolved per schema resource — the document root and every subschema with its own `$id`/`$schema` — not once per file. Supported dialects are draft-04, draft-06, draft-07, 2019-09 and 2020-12; nodes carry their dialect in metadata, and keywords outside it are reported as warnings by default and not applied to generated code. See [docs/dialects.md](./docs/dialects.md).

---

## 📦 Packages

### [`@utilize/json-schema`](./packages/json-schema)

[![npm version](https://img.shields.io/npm/v/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)

> Core utilities for resolving $refs and linking JSON Schema. Provides a generator-agnostic pipeline for schema transformation.

### [`@utilize/zod`](./packages/zod)

[![npm version](https://img.shields.io/npm/v/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)

> Zod code generator. Walks the parsed JSON Schema and emits Zod schemas + TypeScript types.

### [`@utilize/effect`](./packages/effect)

[![npm version](https://img.shields.io/npm/v/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)

> Effect Schema code generator. Walks the parsed JSON Schema and emits Effect Schema codecs + TypeScript types, with every `$ref` emitted through `Schema.suspend`.

### [`@utilize/typescript`](./packages/typescript)

[![npm version](https://img.shields.io/npm/v/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)

> TypeScript type generator. Walks the parsed JSON Schema and emits interfaces and type aliases, with no runtime dependency.

---

```typescript
import { compile as compileZod } from '@utilize/zod';
import { compile as compileEffect } from '@utilize/effect';
import { compile as compileTypescript } from '@utilize/typescript';

await compileZod({
	input: './schema.json',
	output: './schema.zod.generated.ts',
});

await compileEffect({
	input: './schema.json',
	output: './schema.effect.generated.ts',
});

await compileTypescript({
	input: './schema.json',
	output: './schema.generated.ts',
});
```

The runtime generators require their runtime as a peer dependency: `zod`
(`>=4.0.0 <5`) and `effect` (`>=4.0.0 <5`); `@utilize/typescript` has no runtime
dependency:

```sh
pnpm add zod effect
```

All three generators ship a CLI that accepts a file, directory or glob, reads
JSON and YAML, and writes to a file, a directory or stdout:

```sh
utilize-zod schema.json schema.generated.ts
utilize-effect --input 'schemas/**/*.json' --output generated/
utilize-typescript --input 'schemas/**/*.yaml' --output generated/
cat schema.yaml | utilize-zod > schema.generated.ts
```

Generated files start with a "do not edit" banner (`--no-banner` omits it). See
the package READMEs for the remaining flags.

## 🧪 Playground

The [`playground`](./playground) package is a browser app for editing multiple
JSON Schema files with references, switching between the Zod, Effect Schema and
TypeScript generators and watching the generated code and schema validation
update live. It is deployed to GitHub Pages:
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
   that take part in a cycle, and the TypeScript generator emits recursive
   interfaces directly (TypeScript needs no annotation)

---

## Supported features

The Zod and Effect Schema generators accept the same input and are checked
against each other by a differential test suite
(`packages/effect/test/parity.test.ts`), so the table below is kept honest by
CI. All three generators are also checked against the official JSON Schema Test
Suite for draft-07:

- **Zod:** 262 of 269 cases (925 of 939 assertions) pass.
- **Effect Schema:** 214 of 269 cases (818 of 939 assertions) pass.
- **TypeScript:** 175 of 269 cases pass at the type level.

All three run the same 269 draft-07 cases. The 16 cases that need external
schemas and the 19 tagged `format-assertion` are skipped: every generator keeps
`format` as an annotation by default, and a type cannot check a format either
way. `formatMode: 'assert'` turns format validation on in both runtime
generators.

The remaining gaps are recorded in each package's `test/suite/` directory:
`knownFailures.ts` for the runtime generators, `knownGaps.ts` for the type-level
runner.

The TypeScript generator has no runtime: validation keywords such as
`minLength`, `pattern` or `uniqueItems` have no type-level equivalent, so they
are ignored. Its runner emits every suite instance as a typed constant and
checks the whole set with one `tsc` pass. The rest are type-only gaps, the
inference trade-off shared with json-schema-to-typescript, or shared parser
gaps. See
[`packages/typescript/README.md`](./packages/typescript/README.md#conformance)
for the full numbers and methodology.

| JSON Schema Keyword                          | Zod | Effect Schema | Notes                                                                        |
| -------------------------------------------- | --- | ------------- | ---------------------------------------------------------------------------- |
| `type`                                       | ✅  | ✅            | Full support, including unions of types                                      |
| `enum`                                       | ✅  | ✅            | Zod deep-equals composites; Effect supports primitives only                  |
| `const`                                      | ✅  | ✅            | Zod deep-equals composites; Effect supports primitives only                  |
| `default`                                    | ✅  | ✅            | Zod decodes with `.default()`; Effect stores it as an annotation             |
| `description` / `title` / `deprecated`       | ✅  | ✅            | Zod `.meta({})`, Effect `.annotate({})`                                      |
| `readOnly`                                   | ✅  | —             | Zod `.readonly()` with `readOnlyKeyword`; Effect keeps it as an annotation   |
| `minimum` / `maximum`                        | ✅  | ✅            | Supported                                                                    |
| `exclusiveMinimum` / `exclusiveMaximum`      | ✅  | ✅            | Supported (boolean draft-04 form included)                                   |
| `multipleOf`                                 | ✅  | ✅            | Supported                                                                    |
| `minLength` / `maxLength`                    | ✅  | ✅            | Effect counts code points, like JSON Schema                                  |
| `pattern`                                    | ✅  | ✅            | Zod `.regex()`, Effect `Schema.isPattern`                                    |
| `format`                                     | ✅  | ✅            | Annotation by default; `formatMode: 'assert'` validates known formats        |
| `properties`                                 | ✅  | ✅            | Supported                                                                    |
| `required`                                   | ✅  | ✅            | Supported                                                                    |
| `additionalProperties`                       | ✅  | ✅            | Zod `z.strictObject`/`.catchall`, Effect keeps excess keys and filters them  |
| `minProperties` / `maxProperties`            | ✅  | ✅            | Counted on the input, so undeclared keys count too                           |
| `patternProperties`                          | ✅  | ✅            | Every matching pattern is validated, then `additionalProperties` applies     |
| `propertyNames`                              | ✅  | ✅            | Supported                                                                    |
| `items`                                      | ✅  | ✅            | Supported                                                                    |
| `prefixItems`                                | ✅  | ✅            | 2020-12 syntax, also via the tuple form of `items`                           |
| `additionalItems`                            | ✅  | ✅            | Supported                                                                    |
| `uniqueItems`                                | ✅  | ✅            | Key-order-insensitive comparison                                             |
| `contains`                                   | ✅  | ✅            | Supported                                                                    |
| `minContains` / `maxContains`                | ❌  | ❌            | Rejected instead of silently dropped                                         |
| `dependencies`                               | ✅  | ✅            | Also covers `dependentRequired` and `dependentSchemas`                       |
| `allOf`                                      | ✅  | ✅            | Zod intersects any schemas; Effect merges disjoint object subschemas         |
| `anyOf`                                      | ✅  | ✅            | Supported                                                                    |
| `oneOf`                                      | ✅  | ✅            | Zod requires exactly one match; Effect uses the exclusive union mode         |
| `not`                                        | ✅  | ✅            | Supported                                                                    |
| `if` / `then` / `else`                       | ✅  | ✅            | Supported                                                                    |
| `discriminator`                              | ✅  | —             | Zod emits a discriminated union; Effect ignores the annotation               |
| `$ref`                                       | ✅  | ✅            | Local, external, cyclic and `$id`/`$anchor` based; boolean targets supported |
| `$defs` / `definitions`                      | ✅  | ✅            | Supported                                                                    |
| `$id` / `$anchor`                            | ✅  | ✅            | Establishes the base URI and resolves fragment identifiers                   |
| `examples`                                   | ✅  | ✅            | Kept as metadata                                                             |
| `$schema`                                    | ✅  | ✅            | Detects draft-04/06/07/2019-09/2020-12 and normalizes newer keywords         |
| `unevaluatedProperties` / `unevaluatedItems` | ✅  | ✅            | Mapped to `additionalProperties` / the items rest (best effort)              |

`✅` supported, `❌` rejected with a clear error, `—` accepted but only kept as
an annotation.

The table covers the two runtime generators; keyword coverage for the TypeScript
generator is in its README (`packages/typescript/README.md#keyword-coverage`).

Zod and Effect Schema infer `type` from a single keyword family (object, array,
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

The generators support self-referencing and mutually recursive schemas, but
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

**TypeScript** emits the recursive type directly, because interfaces and
deferred aliases can refer to themselves:

```ts
export interface Tree {
	name: string;
	children?: Array<Tree>;
	[key: string]: unknown;
}
```

A cycle that only passes through aliases, unions or intersections — for example
`type A = A | string` — has no type TypeScript can express, so generation fails
with `UnsupportedCircularTypeError` instead of emitting code that does not
compile.

---

## 🤔 Why Utilize Schema?

- **No more hand-written schemas:** Automate validation and types for Zod or Effect Schema, or generate TypeScript types alone.
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

Inspired by [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) and the Zod community. [`@utilize/typescript`](./packages/typescript) is a drop-in alternative to it, built on the same parser as the runtime generators.
