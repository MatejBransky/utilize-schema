# Notes

<!--toc:start-->

- [🧱 Core Pipeline (Agnostic to Code Generator)](#-core-pipeline-agnostic-to-code-generator)
  - [1. **Dereferencer**](#1-dereferencer)
  - [2. **Linker**](#2-linker)
  - [3. **Normalizer**](#3-normalizer)
  - [4. **Parser (AST Builder)**](#4-parser-ast-builder)
  - [5. **Optimizer**](#5-optimizer)
- [🧩 Generator Pipeline (Zod + TypeScript specific)](#-generator-pipeline-zod-typescript-specific)
  - [6. **Generator: Zod + TypeScript**](#6-generator-zod-typescript)
- [🛠️ CLI](#-cli)
- [🧪 JSON Schema Draft 7 Feature Support Overview](#-json-schema-draft-7-feature-support-overview)
  - [🛠 Recommendation](#-recommendation)
  <!--toc:end-->

## 🧱 Core Pipeline (Agnostic to Code Generator)

These steps represent reusable transformations of JSON Schema, designed to prepare schema data for any kind of code generator (Zod, Yup, OpenAPI types, ArkType, etc.).

---

### 1. **Dereferencer**

- Uses `@apidevtools/json-schema-ref-parser` to fully resolve all `$ref` references in the input schema.
- Supports external files and URL references.
- Keeps track of original `$id` and `$ref` values for traceability.

---

### 2. **Linker**

- Enhances each node in the schema with:
  - A reference to its parent node.
  - A computed path or breadcrumb for context.
- Useful for context-aware validation and error reporting later in the pipeline.

---

### 3. **Normalizer**

- Ensures schema consistency:
  - Expands shorthand (`type: ["string", "null"]` ➝ `anyOf`).
  - Normalizes keywords like `exclusiveMinimum`, `default`, or `examples`.
  - Converts `const` ➝ `enum`, or expands `required` properties.
- Makes schemas structurally predictable and easier to consume.

---

### 4. **Parser (AST Builder)**

- Parses the normalized schema into a clean Abstract Syntax Tree (AST):
  - Each node in the AST represents a distinct schema construct (object, union, primitive, etc.).
  - AST nodes are language-neutral and independent of code generators.

---

### 5. **Optimizer**

- Simplifies the AST:
  - Removes unused or redundant definitions.
  - Merges similar schemas.
  - Canonicalizes complex constructs (e.g., `allOf` flattening).

---

## 🧩 Generator Pipeline (Zod + TypeScript specific)

This part is specialized for generating **Zod schemas** and **TypeScript types** from the AST.

---

### 6. **Generator: Zod + TypeScript**

- Walks the optimized AST to emit:
  - `z.object({...})`, `z.union([...])`, etc.
  - TypeScript types inferred from Zod output (`z.infer<typeof X>`).
- Adds `zod.describe()` calls where `title` or `description` are provided.
- Supports `default`, `nullable`, `enum`, `pattern`, etc.

---

## 🛠️ CLI

- Provides a CLI interface for end users:
  - Accepts a JSON Schema file or directory.
  - Runs the full pipeline.
  - Outputs:
    - TS files (Zod schema + inferred types)

---

> ⚠️ Note: While the core pipeline is generator-agnostic, generators may impose limitations (e.g., Zod can't directly support `if/then/else`, `dependencies`, or `patternProperties` in TS types). These cases should emit metadata or helper comments to inform the developer of semantic gaps.

---

## 🧪 JSON Schema Draft 7 Feature Support Overview

This table summarizes the support status of various JSON Schema features in the context of:

- ✅ = supported natively in Zod (and thus in generator output)
- ⚠️ = partially supported (requires manual workaround or metadata)
- ❌ = not supported directly, needs custom logic or cannot be expressed in TS

> Notes:
>
> - `TS Type` means whether the inferred TypeScript type will be accurate.
> - All `$ref` are resolved using `@apidevtools/json-schema-ref-parser`.

| JSON Schema Keyword       | Zod Support | TS Type Support | Notes / Workaround                                                                                                                                                  |
| ------------------------- | ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                    | ✅          | ✅              | Core feature, directly mapped                                                                                                                                       |
| `enum`                    | ✅          | ✅              | Mapped to `z.enum([...])`                                                                                                                                           |
| `const`                   | ✅          | ✅              | Mapped to `z.literal(...)`                                                                                                                                          |
| `default`                 | ✅          | ✅              | Use `.default(...)` in Zod                                                                                                                                          |
| `description` / `title`   | ✅          | ✅              | Use `.describe(...)` in Zod                                                                                                                                         |
| `minimum` / `maximum`     | ✅          | ✅              | Mapped to `.min()` / `.max()`                                                                                                                                       |
| `exclusiveMinimum`        | ✅          | ✅              | Mapped with `.gt()`                                                                                                                                                 |
| `multipleOf`              | ✅          | ⚠️              | Use `.multipleOf()`, not reflected in TS                                                                                                                            |
| `divisibleBy` (alias)     | ✅ (alias)  | ⚠️              | Treated same as `multipleOf`                                                                                                                                        |
| `minLength` / `maxLength` | ✅          | ✅              | Mapped to `.min()` / `.max()` on strings                                                                                                                            |
| `pattern`                 | ✅          | ⚠️              | Use `.regex(...)`, but TS cannot infer shape of valid values                                                                                                        |
| `patternProperties`       | ⚠️          | ⚠️              | Use `z.record()` + `.refine()` or metadata for type hints                                                                                                           |
| `format`                  | ⚠️          | ❌              | Some formats (`email`, `uuid`, `url`, `datetime`, etc.) are supported natively in Zod (e.g., `z.string().email()`). Other formats can be handled using `.refine()`. |
| `examples`                | ⚠️          | N/A             | Use `.superRefine()` or custom validator to assert example values                                                                                                   |
| `required`                | ✅          | ✅              | Handled within `z.object(...)`                                                                                                                                      |
| `properties`              | ✅          | ✅              | Core Zod object handling                                                                                                                                            |
| `additionalProperties`    | ⚠️          | ⚠️              | Can use `.passthrough()` or `.strict()`, but nuanced                                                                                                                |
| `dependencies`            | ❌          | ❌              | Requires post-parse refinement logic                                                                                                                                |
| `if` / `then` / `else`    | ❌          | ❌              | Not directly expressible in Zod, requires conditional refine logic                                                                                                  |
| `uniqueItems`             | ⚠️          | ⚠️              | Use `.refine()` to validate uniqueness in arrays                                                                                                                    |
| `not`                     | ❌          | ❌              | No Zod equivalent, requires manual refinement                                                                                                                       |
| `oneOf`                   | ⚠️          | ⚠️              | Can be approximated with `z.union().refine()`, but not exclusive by default                                                                                         |
| `anyOf`                   | ✅          | ⚠️              | Use `z.union()` or custom fallback logic                                                                                                                            |
| `allOf`                   | ⚠️          | ⚠️              | Requires intersection + flattening constraints                                                                                                                      |

---

### 🛠 Recommendation

To handle unsupported or partially supported features:

- Use `.refine()` or `.superRefine()` for conditional validation (`dependencies`, `if/then`, `not`, etc.)
- Annotate nodes in the AST with metadata (e.g., original pattern, format, constraint) for downstream use
- Consider generating developer hints/comments in the output TypeScript
- You can extend Zod types with branded types or utility functions that augment runtime + TS types.
- Use template literal types cautiously to simulate key patterns (for `patternProperties`), e.g.:

```ts
type TempSensor = {
  [K in `temp:${string}`]: number;
};
```
