# @utilize/zod

## 0.9.0

### Minor Changes

- 5abdb72: Add a `customSchemaResolver(schema)` option to all three generators and their `compile()` functions. It is called for every object schema node, including `$ref` nodes and each type of a `type` list, and returns a Zod expression, an Effect Schema expression or a TypeScript type that replaces the node, so callers can map formats, keywords or whole schemas. Returning `undefined` keeps the default behavior. In Zod and Effect the expression replaces the whole node, so no metadata, default or annotations are added to it; the TypeScript generator keeps the node's JSDoc. Inside a recursive schema the generated value type types a replaced node as `unknown`. `@utilize/effect` and `@utilize/typescript` export the `CustomSchemaResolver` type like `@utilize/zod`.
- 8880cde: Add an optional `format(code)` hook to `compile()`, `compileFile()` and `compileSchema()`. The formatter may be synchronous or asynchronous, so consumers can run Prettier (or another formatter) over the generated code before the banner is prepended. Each package exports the `CodeFormatter` type for it.
- 3338340: Resolve `$ref`s against `$id` and `$anchor` identifiers. A relative reference now uses the nearest `$id` as its base URI, fragment-only identifiers such as `#name` resolve to an `$id: "#name"` or `$anchor: "name"` declaration, a sibling `$id` or `$anchor` of a `$ref` follows the dialect (ignored in draft-07 and older, applied in 2019-09 and newer), and draft-04 `id` identifiers are resolved too. This fixes bundled schemas and raises the official draft-07 conformance to 246/271 cases for Zod, 214/269 for Effect Schema and 173/288 for TypeScript.

  Generate `patternProperties` in the Zod and Effect Schema generators. Every matching pattern is validated (including overlapping patterns), while `additionalProperties` applies only to keys that match no pattern.

- 71d2de1: Add a `formatMap` option that maps `format` names to Zod string expressions. Each entry overrides the built-in mapping for that format, so both unknown and known formats can be customized, while formats that are not listed keep the built-in mapping. `minLength`, `maxLength` and `pattern` are still appended.

### Patch Changes

- c5c1976: Treat a `format` named after a built-in object key, such as `constructor` or `toString`, as an unknown format. It used to emit the source of a JavaScript function instead of a Zod schema.
- Updated dependencies [3338340]
  - @utilize/json-schema@0.5.0

## 0.8.0

### Minor Changes

- 8fc5c59: Resolve and validate the JSON Schema dialect per resource.

  `$schema` is now read at every schema resource (the document root and every
  subschema with a non-fragment `$id`), and the resolved dialect is copied into
  `Meta.dialect` / `Meta.dialectSource`. Keywords that do not belong to the
  node's dialect are reported as warnings by default. `parse()` and `compile()`
  accept `dialect`, `fallbackDialect`, `unknownDialect`, `keywordPolicy` and
  `onDialectIssue`; `keywordPolicy: 'error'` fails on such keywords and `'ignore'`
  does not report them. `parse()` also returns the reported issues, and the core
  library no longer writes them to the console; the zod and effect `compile()`
  functions and CLIs still print them. An unrecognized `$schema` falls back to
  `fallbackDialect`; pass `unknownDialect: 'error'` to reject it. The
  `utilize-zod` and `utilize-effect` CLIs expose the same options.

- a4f93b0: Apply `$ref` siblings and keyword shapes according to the schema dialect.

  In draft-04/06/07 a `$ref` ignores every keyword next to it, while 2019-09 and
  2020-12 apply them. Zod now emits `z.intersection(reference, siblings)` for the
  latter. Effect merges disjoint object siblings into one struct and checks any
  other siblings with a filter on the reference, which also works for recursive
  schemas. Both generators stop applying foreign refinements to a `$ref`. Tuple
  keywords, `const`, `contains`, `propertyNames`, `if`/`then`/`else`, `dependent*`
  and `unevaluated*` only take effect in dialects that define them, so a schema
  compiled with `keywordPolicy: 'warn'` or `'ignore'` generates code that matches
  the standard instead of being stricter.

- 3095614: Add `schemaName` and `typeName` options to `generate()` and `compile()`. Each is a callback that receives the name resolved for a standalone schema (`$id`, `title`, the `$defs` key or the file name) and returns the name to emit, so appending a `Schema` suffix is `(name) => name + 'Schema'`. Both default to the resolved name, a mapped name keeps its casing when it is already a valid identifier and is turned into one otherwise. Mapped names never take another schema's name, and `$ref`s follow a renamed schema variable. `$ref` targets now also use the name returned by `customNameResolver`.

### Patch Changes

- Updated dependencies [8fc5c59]
- Updated dependencies [3e62e0e]
  - @utilize/json-schema@0.4.0

## 0.7.1

### Patch Changes

- 2f292c3: Anchor cycles on inline object and array nodes, so a recursive `oneOf` through an object property holding an array compiles and infers a recursive type.
- 001cddd: Emit required tuple items up to `minItems` and drop `.rest()` and the redundant length check when `maxItems` fixes the length, so fixed-size arrays infer `[T, T]` instead of `[T?, T?, ...unknown[]]`.

## 0.7.0

### Minor Changes

- 5f724d6: Add `utilize-zod` and `utilize-effect` CLIs that compile a JSON or YAML schema from a file, directory, glob or stdin to a file, a directory or stdout. Generated files now start with a "do not edit" banner by default (`bannerComment: false` to omit it). The parser and both `compile()` functions no longer log progress to stdout.
- ff39a85: Map 2019-09/2020-12 `unevaluatedProperties` and `unevaluatedItems` to `additionalProperties` and the items rest instead of failing, keep `deprecated` in the generated `.meta()`, and add a `readOnlyKeyword` option that maps `readOnly: true` to `.readonly()`.
- dbe644b: Compare `const` and `enum` values by deep equality instead of identity: object values become strict objects and array values become exact tuples. Also enforce `oneOf` exactly-one semantics; a value matching several branches is now rejected.
- 6ad41a2: Intersect keywords next to `allOf`, `anyOf` and `oneOf` instead of dropping them. A schema such as `{ allOf: [...], properties: {...} }` now rejects data the previous output accepted. `$ref` still overrides its siblings, as draft-07 requires.

### Patch Changes

- 6ad41a2: Support `$ref` to a boolean schema instead of throwing. `$ref` to `true` emits `z.any()` and `$ref` to `false` emits `z.never()`.
- 98f9758: Drop the runtime `lodash` import from `compile()`, make `output` optional in `CompileOptions`, declare `zod` as a peer dependency instead of a regular one, and publish only `dist`.
- Updated dependencies [6ad41a2]
- Updated dependencies [5f724d6]
- Updated dependencies [ff39a85]
  - @utilize/json-schema@0.3.0

## 0.6.0

### Minor Changes

- f7fd83b: Enforce the `uniqueItems`, `minProperties` and `maxProperties` keywords instead of silently dropping them. These constraints now reject data that the previous output accepted, so the bump is minor rather than a patch.

## 0.5.0

### Minor Changes

- a25f59a: Generate `allOf` with any number of subschemas using nested `z.intersection()` calls.
- a25f59a: Detect the JSON Schema draft from `$schema` and normalize 2019-09 and 2020-12 keywords to the draft-07 model.
- a25f59a: Emit typed `z.lazy()` schemas and generated value types for recursive `$ref`s that cannot be deferred with a getter, so recursive output type-checks.
- a25f59a: Support `not`, `if`/`then`/`else`, `contains`, `propertyNames` and `dependencies` with refinements.

### Patch Changes

- dbfa88e: break cyclic $refs at object properties; cycles that cannot be deferred with a getter now fail at generation instead of producing code that throws at import
- a25f59a: Enforce required object keys that are not declared in `properties`.
- dbefc30: Update the build toolchain and runtime dependencies, and publish ESM builds
  with tsdown.
- a25f59a: Annotate recursive schemas with `z.ZodType` instead of an inline import type.
- Updated dependencies [a7d3cf0]
- Updated dependencies [a25f59a]
- Updated dependencies [dbefc30]
  - @utilize/json-schema@0.2.0

## 0.4.1

### Patch Changes

- 8c0c238: fix boolean default values conversion from string ones to boolean ones

## 0.4.0

### Minor Changes

- d56dd72: updated external deps

### Patch Changes

- Updated dependencies [d56dd72]
  - @utilize/json-schema@0.1.0

## 0.3.2

### Patch Changes

- Updated dependencies [28889b5]
  - @utilize/json-schema@0.0.4

## 0.3.1

### Patch Changes

- 9d91589: fixed compile options

## 0.3.0

### Minor Changes

- 4e9a14e: added custom schema name resolver

## 0.2.3

### Patch Changes

- 8bc03cb: added README
- Updated dependencies [8bc03cb]
  - @utilize/json-schema@0.0.3

## 0.2.2

### Patch Changes

- c31ca83: handled missing schema.properties in objectGenerator

## 0.2.1

### Patch Changes

- removed

## 0.2.0

### Minor Changes

- af4352b: fixed object predicate

## 0.1.1

### Patch Changes

- 9bf2159: fixed sorting
- Updated dependencies [9bf2159]
  - @utilize/json-schema@0.0.2

## 0.1.0

### Minor Changes

- 61ce5c4: added missing generator export
