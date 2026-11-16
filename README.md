# Utilize Schema Monorepo

Generate robust, type-safe Zod schemas and TypeScript types from JSON Schema — with first-class support for references, standalone definitions, and modern validation features.

---

## ✨ Features

- **$ref support:** Local, external, and cyclic references. Recursive schemas are emitted as getters or typed `z.lazy()`.
- **Standalone schema generation:** Every definition gets its own Zod schema and type.
- **TypeScript-first:** Generates runtime Zod schemas and inferred TypeScript types, including recursive ones.
- **Draft support:** Draft-04/06/07, with normalization for 2019-09 and 2020-12.

---

## 📦 Packages

### [`@utilize/json-schema`](./packages/json-schema)

> Core utilities for resolving $refs and linking JSON Schema. Provides a generator-agnostic pipeline for schema transformation.

### [`@utilize/zod`](./packages/zod)

> Zod code generator. Walks the parsed JSON Schema and emits Zod schemas + TypeScript types.

---

```typescript
import { compile } from '@utilize/zod';

await compile({
	input: './schema.json',
	output: './schema.generated.ts',
});
```

---

## Architecture

1. $ref resolver: resolves all $ref (local, external, cyclic)
2. linker: annotates node with metadata (parent, referenced schema)
3. cycle handling: finds recursive $refs and breaks them with a getter or typed `z.lazy()`
4. generator: emits Zod schemas and TypeScript types, deriving value types for recursive schemas

---

## Supported features

| JSON Schema Keyword                     | Supported? | Notes                                                                       |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `type`                                  | ✅         | Full support                                                                |
| `enum`                                  | ✅         | Strings use `z.enum()`; other values use `z.literal()`                      |
| `const`                                 | ✅         | Uses `z.literal()`                                                          |
| `default`                               | ✅         | Uses `.default()`                                                           |
| `description` / `title`                 | ✅         | Uses `.meta({})`                                                            |
| `minimum` / `maximum`                   | ✅         | Supported                                                                   |
| `exclusiveMinimum` / `exclusiveMaximum` | ✅         | Supported                                                                   |
| `multipleOf`                            | ✅         | Supported                                                                   |
| `minLength` / `maxLength`               | ✅         | Supported                                                                   |
| `pattern`                               | ✅         | Uses `.regex()`                                                             |
| `format`                                | ✅         | Known formats map to Zod helpers; unknown formats fall back to `z.string()` |
| `properties`                            | ✅         | Supported                                                                   |
| `required`                              | ✅         | Supported                                                                   |
| `additionalProperties`                  | ✅         | Supported                                                                   |
| `patternProperties`                     | ❌         | Planned, not generated yet                                                  |
| `propertyNames`                         | ✅         | Uses `.superRefine()`                                                       |
| `items`                                 | ✅         | Supported                                                                   |
| `additionalItems`                       | ✅         | Supported                                                                   |
| `contains`                              | ✅         | Uses `.superRefine()`                                                       |
| `dependencies`                          | ✅         | Uses `.superRefine()`                                                       |
| `allOf`                                 | ⚠️         | Only two schemas supported via `z.intersection()`, more planned             |
| `anyOf`                                 | ✅         | Uses `z.union()`                                                            |
| `oneOf`                                 | ✅         | Uses `z.union()`                                                            |
| `not`                                   | ✅         | Uses `.refine()`                                                            |
| `$ref`                                  | ✅         | Supported                                                                   |
| `$defs` / `definitions`                 | ✅         | Supported                                                                   |
| `if` / `then` / `else`                  | ✅         | Uses `.superRefine()`                                                       |
| `discriminator`                         | ✅         | Uses `z.discriminatedUnion()`                                               |
| `$id`                                   | ✅         | Used in `.meta({ id })`; does not affect $ref resolution                    |
| `examples`                              | ✅         | Uses `.meta({ examples })`                                                  |
| `$schema`                               | ✅         | Detects draft-04/06/07/2019-09/2020-12; normalizes newer keywords           |

Schemas that omit `type` infer it from a single keyword family (object, array,
string or number), so constraints such as `{ pattern }` or `{ required }`
are not silently dropped.

2020-12 `prefixItems` maps to the tuple form of `items`, and
`dependentRequired`/`dependentSchemas` map to `dependencies`. Unknown
`$schema` values fall back to draft-07. 2019-09/2020-12 keywords without a
generator (`unevaluatedProperties`, `unevaluatedItems`, `$recursiveRef`,
`$dynamicRef`) fail with `UnsupportedSchemaFeatureError`.

---

## 🔁 Cyclic references

Recursive `$ref`s are emitted as getters on object properties. That is how Zod
supports recursive types while keeping TypeScript inference, and cycles are
broken at the property that contains the recursion.

Cycles that cannot be deferred with a getter — array items, tuples, records and
recursive `additionalProperties` — are emitted as `z.lazy()` together with a
generated value type. The exported schema is annotated as `z.ZodType<Value>`,
so TypeScript can still infer the recursive type. Schema-specific methods such
as `.shape` are not available on those annotated consts; non-recursive schemas
keep their concrete Zod types.

A cycle that only passes through unions or aliases has no value type TypeScript
can express recursively. Generation then fails with
`UnsupportedCyclicReferenceError` and the locations of the refs in the cycle,
instead of emitting code that does not type-check.

The generated `Value` aliases are internal. Use the exported type, for example
`export type ListCycle = z.infer<typeof ListCycle>`, in your own code.

---

## 🤔 Why Utilize Schema?

- **No more hand-written Zod schemas:** Automate your validation and types.
- **Handles real-world schemas:** Works with complex, modular, and referenced schemas.
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
