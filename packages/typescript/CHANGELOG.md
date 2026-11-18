# @utilize/typescript

## 0.3.1

### Patch Changes

- 752d60c: Resolve a `$ref` with a JSON pointer fragment, such as `#/definitions/a` or `other.json#/definitions/b`, against the nearest `$id` instead of the root document. A pointer inside an embedded `$id` resource now links to that resource's definition, and a `../` reference from a referenced file is linked. This raises the official draft-07 conformance to 248/271 cases for Zod and 175/288 for TypeScript.
- Updated dependencies [752d60c]
  - @utilize/json-schema@0.5.1

## 0.3.0

### Minor Changes

- 5abdb72: Add a `customSchemaResolver(schema)` option to all three generators and their `compile()` functions. It is called for every object schema node, including `$ref` nodes and each type of a `type` list, and returns a Zod expression, an Effect Schema expression or a TypeScript type that replaces the node, so callers can map formats, keywords or whole schemas. Returning `undefined` keeps the default behavior. In Zod and Effect the expression replaces the whole node, so no metadata, default or annotations are added to it; the TypeScript generator keeps the node's JSDoc. Inside a recursive schema the generated value type types a replaced node as `unknown`. `@utilize/effect` and `@utilize/typescript` export the `CustomSchemaResolver` type like `@utilize/zod`.
- 8880cde: Add an optional `format(code)` hook to `compile()`, `compileFile()` and `compileSchema()`. The formatter may be synchronous or asynchronous, so consumers can run Prettier (or another formatter) over the generated code before the banner is prepended. Each package exports the `CodeFormatter` type for it.

### Patch Changes

- 3338340: Resolve `$ref`s against `$id` and `$anchor` identifiers. A relative reference now uses the nearest `$id` as its base URI, fragment-only identifiers such as `#name` resolve to an `$id: "#name"` or `$anchor: "name"` declaration, a sibling `$id` or `$anchor` of a `$ref` follows the dialect (ignored in draft-07 and older, applied in 2019-09 and newer), and draft-04 `id` identifiers are resolved too. This fixes bundled schemas and raises the official draft-07 conformance to 246/271 cases for Zod, 214/269 for Effect Schema and 173/288 for TypeScript.

  Generate `patternProperties` in the Zod and Effect Schema generators. Every matching pattern is validated (including overlapping patterns), while `additionalProperties` applies only to keys that match no pattern.

- Updated dependencies [3338340]
  - @utilize/json-schema@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [8fc5c59]
- Updated dependencies [3e62e0e]
  - @utilize/json-schema@0.4.0

## 0.2.0

### Minor Changes

- 67d62a6: Add a `utilize-typescript` CLI. It accepts a schema file, directory or glob, reads JSON and YAML, and writes the generated types to a file, a directory or stdout, with `--cwd` and `--no-banner` flags.

  `compile()` now also reads YAML and prepends the standard "do not edit" banner, and the new `compileFile`, `compileSchema`, `readSchema` and `withBanner` helpers match the other generators.

- 7041555: Add `@utilize/typescript`, a JSON Schema to TypeScript generator. It emits one interface or type alias per standalone schema, turns objects into interfaces, `allOf` into intersections, `anyOf`/`oneOf` into unions and `enum`/`const` into literal types, supports local, external and recursive `$ref`s, maps `additionalProperties` and `patternProperties` to index signatures, and rejects cycles TypeScript cannot express. It has no runtime dependency and is a drop-in alternative to `json-schema-to-typescript`.

  The generator is checked against the official JSON Schema Test Suite (draft-07) at the type level: every suite instance is emitted as a typed constant and one `tsc --strict` run decides whether valid instances are accepted and invalid ones rejected. The current baseline is 167 of 288 cases, with 788 of 814 valid instances accepted and 209 of 788 invalid instances rejected; the record and the known gaps live in `test/suite/`.

### Patch Changes

- aee9c97: Skip the declaration JSDoc title when it only repeats the generated type name. `title: 'Address'` no longer emits `/** Address */` above `export interface Address`, while titles that add information beyond the name are kept.
