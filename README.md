# Utilize Schema Monorepo

Generate robust, type-safe Zod schemas and TypeScript types from JSON Schema — with first-class support for references, standalone definitions, and modern validation features.

---

## ✨ Features

- **Full $ref support:** Handles local, external, and cyclic references.
- **Standalone schema generation:** Every definition gets its own Zod schema and type.
- **TypeScript-first:** Generates both runtime Zod schemas and inferred TS types.
- **Draft 7 support:** Covers most of JSON Schema Draft 7, with clear metadata for edge cases.

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
3. generator: emits Zod schema and TypeScript types

---

## Supported features

| JSON Schema Keyword                     | Supported? | Notes                                                                                   |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `type`                                  | ✅         | Full support                                                                            |
| `enum`                                  | ✅         | Only primitive values (via `z.enum()` or `z.literal()`)                                 |
| `const`                                 | ✅         | Uses `z.literal()`                                                                      |
| `default`                               | ✅         | Uses `.default()`                                                                       |
| `description` / `title`                 | ✅         | Uses `.meta({})`                                                                        |
| `minimum` / `maximum`                   | ✅         | Supported                                                                               |
| `exclusiveMinimum` / `exclusiveMaximum` | ✅         | Supported                                                                               |
| `multipleOf`                            | ✅         | Supported                                                                               |
| `minLength` / `maxLength`               | ✅         | Supported                                                                               |
| `pattern`                               | ⚠️         | Work in progress                                                                        |
| `format`                                | ✅         | Supported                                                                               |
| `properties`                            | ✅         | Supported                                                                               |
| `required`                              | ✅         | Supported                                                                               |
| `additionalProperties`                  | ✅         | Supported                                                                               |
| `patternProperties`                     | ⚠️         | Partial support, work in progress                                                       |
| `propertyNames`                         | ❌         | Planned                                                                                 |
| `items`                                 | ✅         | Supported                                                                               |
| `additionalItems`                       | ✅         | Supported                                                                               |
| `contains`                              | ❌         | Planned                                                                                 |
| `dependencies`                          | ❌         | Planned                                                                                 |
| `allOf`                                 | ⚠️         | Only two schemas supported via `z.intersection()`, more planned                         |
| `anyOf`                                 | ✅         | Uses `z.union()`                                                                        |
| `oneOf`                                 | ✅         | Uses `z.union()`                                                                        |
| `not`                                   | ❌         | Planned                                                                                 |
| `$ref`                                  | ✅         | Supported                                                                               |
| `$defs` / `definitions`                 | ✅         | Supported                                                                               |
| `if` / `then` / `else`                  | ❌         | Planned                                                                                 |
| `discriminator`                         | ✅         | Uses `z.discriminatedUnion()`                                                           |
| `$id`                                   | ✅         | Supported                                                                               |
| `examples`                              | ❌         | Not supported                                                                           |
| `$schema`                               | ⚠️         | Planned: Will detect and support multiple JSON Schema versions based on `$schema` value |

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
