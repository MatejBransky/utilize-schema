# @utilize/effect

## 0.7.0

### Minor Changes

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

- d770676: Import structural format validators at runtime instead of inlining them.

  Generated Zod and Effect schemas now import the validators for formats such as
  `email`, `hostname`, `uri` and `date-time` from `@utilize/json-schema/formats`
  (for example `formatEmail` and `formatUri`) instead of emitting a copy of each
  body in every generated file. Apps that run generated schemas must keep
  `@utilize/json-schema` as a runtime dependency; only the validators a file uses
  survive bundling.

  `@utilize/json-schema` exports the new `./formats` entry. `formatBody` is
  removed; import the matching validator from that entry instead.

- 5b4734f: Fix native JSON Schema conformance gaps without introducing a custom runtime: resolve draft-04 legacy `id` references, align UUID/duration/hostname format semantics with the specification, and handle Effect `dependentRequired`/`dependentSchemas` on objects without an explicit `type`.
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

### Patch Changes

- 9862f23: Keep UUID validation in the shared runtime entry and preserve generated field
  types in the playground.

  The playground now registers declarations for `@utilize/json-schema/formats`,
  so Monaco resolves imported validators instead of falling back to `any`.

  Zod and Effect schemas import every JSON Schema-specific format check from the
  shared entry. UUID, JSON Pointer, URL and the pattern-based Effect formats no
  longer emit inline regexes; target-native helpers such as `z.url()` stay native.

- 36b46ac: Add `isJSONSchema`, `isJSONSchemaObject`, `isParsedJSONSchema` and `isParsedJSONSchemaObject` runtime guards so callers can narrow raw and linked schema values without unsafe type assertions, plus `reachesThrough` for shared graph traversal.

  Type boolean schema documents correctly through `readSchema`, `parseSchemaSource`, `parseForCompile` and each generator's `compileSchema`, share the file-reading and parse paths through `bindCompileFile` and `withParsedSchema`, and export the CLI flag value types used by the public `GeneratorCli` signature. `schemaRecord` now accepts a `JSONSchema` instead of the broad `object`, and `withSourceMeta` now rejects a source without metadata instead of silently producing an unmarked copy.

- Updated dependencies [27958a0]
- Updated dependencies [d770676]
- Updated dependencies [5b4734f]
- Updated dependencies [60be53c]
- Updated dependencies [9862f23]
- Updated dependencies [36b46ac]
  - @utilize/json-schema@0.8.0

## 0.6.0

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

## 0.5.1

### Patch Changes

- f012b77: Bump js-yaml from 5.4.2 to 5.5.0.

## 0.5.0

### Minor Changes

- 00cd219: Support `minContains` and `maxContains` in the runtime generators. The parser no longer rejects them, and both generators count the items matching `contains`, applying the bounds only in 2019-09 and newer. `minContains: 0` allows an array without a match, and both keywords are ignored without `contains`. A plain `contains` keeps its single-match check and its message.

  Zod also compiles `pattern` and `patternProperties` regular expressions in Unicode mode, so property escapes such as `\p{Letter}` match as the specification expects. A pattern that is not valid in Unicode mode (`\-`, `a{`, ...) now fails at generation time with an error that names the keyword and the pattern, instead of crashing while emitting code.

  Effect now skips `contains` in dialects that do not have it (draft-04), as Zod does, so a schema whose ignored `contains` subschema Effect cannot express no longer fails to generate.

- 91281a2: Merge `allOf` subschemas that constrain one JSON type, and handle boolean, empty and nested members. Bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `uniqueItems`) combine into the strictest one, `true` and empty members are ignored, `false` rejects everything, and nested `allOf` is flattened. Applicators (`anyOf`, `oneOf`) and any other member that cannot be merged are applied as `Schema.makeFilter` checks over each member, so every combination the generator can express is supported. `additionalProperties` declared by one member is not merged with properties declared by another, and a checked reference next to `allOf` is wrapped in a union because Effect cannot add checks to `Schema.suspend`. This fixes 26 draft-07 suite cases.
- 98ddaf9: Compare `const` and `enum` values structurally instead of rejecting objects and
  arrays. Effect has no literal form for them, so a structured value is emitted as
  a `Schema.Json` filter that compares canonical JSON. The helper takes the
  literal's type as a parameter, so a nested literal in a recursive schema still
  matches the annotation of the declaration. Comparison ignores key order and
  keeps JSON types distinct (`[false]` does not match `[0]`). This fixes 12
  draft-07 suite cases.
- ee7cbae: Apply `contains` and `dependencies` to schemas without a `type`, keep the keywords declared next to `anyOf`/`oneOf` (a `type` there is also given to the untyped members, so the decoded type is narrowed to it), count identical `oneOf` branches separately, and emit `__proto__` as a computed key so it does not change the prototype of the generated `Schema.Struct`, also when it comes from merged object subschemas. This fixes 15 draft-07 suite cases.
- 19536a4: Add `externalSchemas` so absolute `$ref` URIs can be served from memory instead of disk or the network. The parser indexes identifiers declared inside a provided document (`$id`, or the draft-04 `id`), and the three `compile()` and `compileSchema()` APIs pass the option through.
- d99505f: Keep the document root when the root is a `$ref`. `parse()` resolved the root pointer with `$refs.get('#')`, so `root` was the referenced value and `root[Meta]` described that value instead of the document. Generated code now emits the root as an alias to the referenced declaration instead of inlining or merging the target, and `referencedSchemas` no longer includes the root document.
- 9f90e21: `format` is now switchable in both runtime generators and asserted by default,
  so `@utilize/zod` and `@utilize/effect` agree on what a known format does.

  Both generators turn known formats into validation (`format: "email"` becomes
  `z.email()` or a `Schema.String.check(formatEmail)`), and keep unknown formats
  as annotations. Pass `formatMode: 'annotate'` to keep `format` as metadata
  (`.meta({ format })` / `.annotate({ format })`); both CLIs take
  `--format-mode annotate|assert`. `formatMap` entries apply in both modes.

  The Effect generator gains the format checks in this release, so schemas with a
  known `format` now reject invalid values by default.

### Patch Changes

- 83be704: Schema dependencies now compile to their object branch instead of a union over
  every JSON value. A `dependencies` subschema without a `type` accepts every
  value, but it is evaluated against an object, so the alternatives for other
  types could never match.

  Both runtime generators now narrow through the same `narrowUntypedSchema`
  helper, so the exclusion list cannot drift between them. As in Zod, a
  dependency narrows only when it declares a type-specific keyword; one that only
  carries annotations stays untyped, which validates the same values.

  Because the subschema is generated as an object, a dependency that only declares
  another dependency, such as `{ "dependencies": { "b": ["c"] } }`, is now checked
  instead of being reduced to `Schema.Json` and ignored, and a dependency that
  only constrains another type no longer emits the union.

- Updated dependencies [00cd219]
- Updated dependencies [19536a4]
- Updated dependencies [d99505f]
- Updated dependencies [83be704]
  - @utilize/json-schema@0.6.0

## 0.4.1

### Patch Changes

- Updated dependencies [752d60c]
  - @utilize/json-schema@0.5.1

## 0.4.0

### Minor Changes

- 5abdb72: Add a `customSchemaResolver(schema)` option to all three generators and their `compile()` functions. It is called for every object schema node, including `$ref` nodes and each type of a `type` list, and returns a Zod expression, an Effect Schema expression or a TypeScript type that replaces the node, so callers can map formats, keywords or whole schemas. Returning `undefined` keeps the default behavior. In Zod and Effect the expression replaces the whole node, so no metadata, default or annotations are added to it; the TypeScript generator keeps the node's JSDoc. Inside a recursive schema the generated value type types a replaced node as `unknown`. `@utilize/effect` and `@utilize/typescript` export the `CustomSchemaResolver` type like `@utilize/zod`.
- 8880cde: Add an optional `format(code)` hook to `compile()`, `compileFile()` and `compileSchema()`. The formatter may be synchronous or asynchronous, so consumers can run Prettier (or another formatter) over the generated code before the banner is prepended. Each package exports the `CodeFormatter` type for it.
- 3338340: Resolve `$ref`s against `$id` and `$anchor` identifiers. A relative reference now uses the nearest `$id` as its base URI, fragment-only identifiers such as `#name` resolve to an `$id: "#name"` or `$anchor: "name"` declaration, a sibling `$id` or `$anchor` of a `$ref` follows the dialect (ignored in draft-07 and older, applied in 2019-09 and newer), and draft-04 `id` identifiers are resolved too. This fixes bundled schemas and raises the official draft-07 conformance to 246/271 cases for Zod, 214/269 for Effect Schema and 173/288 for TypeScript.

  Generate `patternProperties` in the Zod and Effect Schema generators. Every matching pattern is validated (including overlapping patterns), while `additionalProperties` applies only to keys that match no pattern.

### Patch Changes

- Updated dependencies [3338340]
  - @utilize/json-schema@0.5.0

## 0.3.0

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

- ab6ba58: Add `schemaName` and `typeName` options to `generate()` and `compile()`. Each is a callback that receives the name resolved for a standalone schema (`$id`, `title`, the `$defs` key or the file name) and returns the name to emit, so appending a `Schema` suffix is `(name) => name + 'Schema'`. Both default to the resolved name, a mapped name keeps its casing when it is already a valid identifier and is turned into one otherwise. Mapped names never take another schema's name, and every `$ref` points at the renamed schema variable.

### Patch Changes

- Updated dependencies [8fc5c59]
- Updated dependencies [3e62e0e]
  - @utilize/json-schema@0.4.0

## 0.2.0

### Minor Changes

- 5f724d6: Add `utilize-zod` and `utilize-effect` CLIs that compile a JSON or YAML schema from a file, directory, glob or stdin to a file, a directory or stdout. Generated files now start with a "do not edit" banner by default (`bannerComment: false` to omit it). The parser and both `compile()` functions no longer log progress to stdout.
- ff39a85: Map 2019-09/2020-12 `unevaluatedProperties` and `unevaluatedItems` to `additionalProperties` and the items rest instead of failing, keep `deprecated` in the generated `.meta()`, and add a `readOnlyKeyword` option that maps `readOnly: true` to `.readonly()`.

### Patch Changes

- 6ad41a2: Support `$ref` to a boolean schema instead of throwing. `$ref` to `true` emits `z.any()` and `$ref` to `false` emits `z.never()`.
- Updated dependencies [6ad41a2]
- Updated dependencies [5f724d6]
- Updated dependencies [ff39a85]
  - @utilize/json-schema@0.3.0

## 0.1.0

### Minor Changes

- 54689a4: Add `@utilize/effect`, a JSON Schema to Effect Schema (v4) generator. It emits one exported const and one `typeof X.Type` per standalone schema, resolves every `$ref` through `Schema.suspend`, supports objects, arrays, tuples, unions, `allOf` object merging and scalar checks, and rejects JSON Schema features that have no Effect Schema equivalent.
