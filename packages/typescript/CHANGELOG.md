# @utilize/typescript

## 0.6.0

### Minor Changes

- 60be53c: Add opt-in JSON Schema validation before generation. `parse` and every
  `compile` accept a `validateSchema` callback that receives each resolved
  document together with the dialect the parser resolved for it, and a finding
  throws `SchemaValidationError` with one report per document.

  The CLIs gain `--validate`, which checks every document (including `$ref`
  targets) against the meta-schema of its dialect — draft-04, draft-06, draft-07,
  2019-09 or 2020-12 — and writes nothing when a schema is invalid. Ajv backs the
  built-in validator and is an optional peer dependency; `--validator <module>`
  replaces it with any function, so Ajv stays out of the install for callers that
  do not validate. Draft-04 schemas also need `ajv-draft-04`.

  `@utilize/json-schema` exports the adapter as the new `./validate/ajv` entry and
  the validation API from the main entry: `SchemaValidator`, the finding, context
  and report types, `SchemaValidationError`, and `resolveDocumentDialect`, which
  resolves a document's dialect the way `parse` does.

- d6876f8: Add opt-in `inference: 'pragmatic'` (and `--inference pragmatic`) to read an
  untyped schema's keyword family as the intended type: `format` becomes `string`,
  `minimum` becomes `number`, `contains` becomes `array`, and so on. The default
  stays `spec`, which keeps those schemas `unknown` because the keywords only
  constrain one instance type.

### Patch Changes

- 27958a0: Reach full draft-07 conformance in both runtime generators. Zod and Effect now
  validate every `format-assertion` case, including RFC 3339 date-time, email and
  IDNA hostnames, URI and IRI references, JSON Pointers, regular expressions and
  URI Templates. Complex validators are emitted once per format and shared by
  every schema in the module that uses them.

  Format assertions now follow the JSON Schema definitions rather than the target's
  looser helpers. Values such as a bare `time` without an RFC 3339 offset, or a
  URL-shaped `uri` that is not a valid RFC 3986 URI, can now be rejected. Generated
  modules that use email or URI formats contain the shared validator source.

  The parser resolves URNs, tag URIs and other in-document identifiers before an
  external read, and both runtime generators handle typeless recursive roots and
  tuple references. Generated Zod schemas also support keyword-only object and
  array cycles without an explicit `type`. The TypeScript generator inherits the
  same reference fixes, raising its draft-07 baseline to 192 of 285 cases.

- 5b4734f: Fix native JSON Schema conformance gaps without introducing a custom runtime: resolve draft-04 legacy `id` references, align UUID/duration/hostname format semantics with the specification, and handle Effect `dependentRequired`/`dependentSchemas` on objects without an explicit `type`.
- 36b46ac: Add `isJSONSchema`, `isJSONSchemaObject`, `isParsedJSONSchema` and `isParsedJSONSchemaObject` runtime guards so callers can narrow raw and linked schema values without unsafe type assertions, plus `reachesThrough` for shared graph traversal.

  Type boolean schema documents correctly through `readSchema`, `parseSchemaSource`, `parseForCompile` and each generator's `compileSchema`, share the file-reading and parse paths through `bindCompileFile` and `withParsedSchema`, and export the CLI flag value types used by the public `GeneratorCli` signature. `schemaRecord` now accepts a `JSONSchema` instead of the broad `object`, and `withSourceMeta` now rejects a source without metadata instead of silently producing an unmarked copy.

- Updated dependencies [27958a0]
- Updated dependencies [d770676]
- Updated dependencies [5b4734f]
- Updated dependencies [60be53c]
- Updated dependencies [9862f23]
- Updated dependencies [36b46ac]
  - @utilize/json-schema@0.8.0

## 0.5.0

### Minor Changes

- 0939ed0: Export the types referenced by exported signatures so consumers can name them: `Writable` and `KeywordIssue` in `@utilize/json-schema`, `ObjectKeys` in `@utilize/effect`, `StandaloneSchemasResult` in `@utilize/typescript`, and the generator predicate, generate and test-option types in `@utilize/zod`. These types were already part of the emitted declarations; the export only makes them importable. The `private-type-leaks` rule now keeps that true.

### Patch Changes

- bab16d9: The CLI and the file-reading part of `compile` now come from `@utilize/json-schema/node`, so the three generators no longer keep their own copies, and they no longer depend on `js-yaml` directly. Flags, help text, exit codes, messages and generated files stay the same.
- Updated dependencies [72afcad]
- Updated dependencies [0939ed0]
- Updated dependencies [338f308]
- Updated dependencies [41afe47]
- Updated dependencies [5d32982]
- Updated dependencies [04c7a38]
- Updated dependencies [4d5c1b2]
- Updated dependencies [75e513a]
- Updated dependencies [d9f8cf8]
- Updated dependencies [91a0ef6]
- Updated dependencies [24d44f0]
- Updated dependencies [0b3806c]
- Updated dependencies [48bae59]
  - @utilize/json-schema@0.7.0

## 0.4.1

### Patch Changes

- f012b77: Bump js-yaml from 5.4.2 to 5.5.0.

## 0.4.0

### Minor Changes

- 19536a4: Add `externalSchemas` so absolute `$ref` URIs can be served from memory instead of disk or the network. The parser indexes identifiers declared inside a provided document (`$id`, or the draft-04 `id`), and the three `compile()` and `compileSchema()` APIs pass the option through.
- d99505f: Keep the document root when the root is a `$ref`. `parse()` resolved the root pointer with `$refs.get('#')`, so `root` was the referenced value and `root[Meta]` described that value instead of the document. Generated code now emits the root as an alias to the referenced declaration instead of inlining or merging the target, and `referencedSchemas` no longer includes the root document.

### Patch Changes

- Updated dependencies [00cd219]
- Updated dependencies [19536a4]
- Updated dependencies [d99505f]
- Updated dependencies [83be704]
  - @utilize/json-schema@0.6.0

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
