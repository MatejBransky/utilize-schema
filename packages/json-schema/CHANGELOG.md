# @utilize/json-schema

## 0.8.0

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

- 36b46ac: Add `isJSONSchema`, `isJSONSchemaObject`, `isParsedJSONSchema` and `isParsedJSONSchemaObject` runtime guards so callers can narrow raw and linked schema values without unsafe type assertions, plus `reachesThrough` for shared graph traversal.

  Type boolean schema documents correctly through `readSchema`, `parseSchemaSource`, `parseForCompile` and each generator's `compileSchema`, share the file-reading and parse paths through `bindCompileFile` and `withParsedSchema`, and export the CLI flag value types used by the public `GeneratorCli` signature. `schemaRecord` now accepts a `JSONSchema` instead of the broad `object`, and `withSourceMeta` now rejects a source without metadata instead of silently producing an unmarked copy.

### Patch Changes

- 9862f23: Keep UUID validation in the shared runtime entry and preserve generated field
  types in the playground.

  The playground now registers declarations for `@utilize/json-schema/formats`,
  so Monaco resolves imported validators instead of falling back to `any`.

  Zod and Effect schemas import every JSON Schema-specific format check from the
  shared entry. UUID, JSON Pointer, URL and the pattern-based Effect formats no
  longer emit inline regexes; target-native helpers such as `z.url()` stay native.

## 0.7.0

### Minor Changes

- 0939ed0: Export the types referenced by exported signatures so consumers can name them: `Writable` and `KeywordIssue` in `@utilize/json-schema`, `ObjectKeys` in `@utilize/effect`, `StandaloneSchemasResult` in `@utilize/typescript`, and the generator predicate, generate and test-option types in `@utilize/zod`. These types were already part of the emitted declarations; the export only makes them importable. The `private-type-leaks` rule now keeps that true.
- 41afe47: Add `expectDefined` for replacing non-null assertions with a throwing invariant, and narrow the Zod runtime helpers with it.
- 75e513a: Remove the deprecated `SchemaVersion` type and `detectSchemaVersion` helper. Use `DialectId` and `detectDialect` instead: `detectDialect(schema)?.dialect.id ?? fallback` returns the same value as the removed helper. Both aliases were `@deprecated` and the repository still re-exported them, so `deprecated-exports-in-use` reported them as dead API.
- d9f8cf8: Rename the `GeneratorCli.flags` field to `parseOptions`. The field is the `parseArgs` option map, not a feature-flag object, and the old name made the `configObjectHeuristics` detector report the CLI's own option map as a feature flag. `runGeneratorCli` behaves the same; the generator CLIs in `@utilize/zod`, `@utilize/effect` and `@utilize/typescript` pass the same object under the new name.
- 91a0ef6: Add the `@utilize/json-schema/node` entry with the Node-only helpers the generators' `compile` functions and CLIs share: `runGeneratorCli`, `formatAndDialectFlags`, `readFormatAndDialectFlags` and `isEntrypoint` for the CLIs, and `readSchema`, `parseSchemaSource`, `parseForCompile`, `compilePaths`, `schemaFileLocation`, `generatedFileBanner` and `prependBanner` for compiling files. They read and write files, so they are not in the main entry, which stays free of `node:*` imports and keeps running in the browser. The package now has an `exports` map (`.`, `./node`, `./dist/*` and `./package.json`) and depends on `js-yaml` to read YAML schemas.
- 24d44f0: Export the naming helpers the generators share: `resolveName`, `resolveExplicitName`, `generateName`, `toSafeString`, `justName`, `stripExtension`, `mapName`, `mapDeclarationNames` and `allocateName`, with the `CustomNameResolver`, `NameMapper`, `ResolveNameOptions`, `DeclarationNames`, `MapDeclarationNamesOptions` and `MappedDeclarationNames` types. Zod, Effect and TypeScript each had their own copy; they now use these. The generators still export the same names as before.
- 0b3806c: Export `SCHEMA_MAP_KEYWORDS`, `SINGLE_SCHEMA_KEYWORDS` and `SCHEMA_ARRAY_KEYWORDS`: the keywords whose value is an object of subschemas, one subschema, or an array of subschemas. The normalizer, the identifier index and the playground's bundler each had their own copy of these lists; they now share one.
- 48bae59: Export `collectStandaloneSchemas`, `childSchemasOf` and the `SchemaEdge` type. The generators each had their own copy of this code; they now share this one. `collectStandaloneSchemas` finds every schema that gets its own declaration (the root, `$defs`/`definitions` entries and `$ref` targets) and the dependency edges between them. The `inlineCopies` and `definitionsOf` options let a generator treat inline copies as references or read definitions its own way.

### Patch Changes

- 72afcad: List the built entry files by name in the `exports` map instead of a `./dist/*` wildcard. `@utilize/zod/dist/index.mjs`, `dist/runtime.mjs`, `dist/cli.mjs` (and `@utilize/json-schema/dist/index.mjs`, `dist/node.mjs`), with their `.d.ts` files, still resolve. Only the bundler's hashed chunk files, whose names change on every build, are no longer importable directly.
- 338f308: Drop the unused `dequal` and `moize` dependencies. Nothing imports them, so installing any generator now downloads four fewer packages (`dequal`, `moize` and its `fast-equals` and `micro-memoize`).
- 5d32982: Name the `compilePaths` and `schemaFileLocation` return types.
- 04c7a38: Accept boolean root schemas in `parse`.
- 4d5c1b2: Narrow `Writable.write` to `void` for the lint migration.

## 0.6.0

### Minor Changes

- 00cd219: Support `minContains` and `maxContains` in the runtime generators. The parser no longer rejects them, and both generators count the items matching `contains`, applying the bounds only in 2019-09 and newer. `minContains: 0` allows an array without a match, and both keywords are ignored without `contains`. A plain `contains` keeps its single-match check and its message.

  Zod also compiles `pattern` and `patternProperties` regular expressions in Unicode mode, so property escapes such as `\p{Letter}` match as the specification expects. A pattern that is not valid in Unicode mode (`\-`, `a{`, ...) now fails at generation time with an error that names the keyword and the pattern, instead of crashing while emitting code.

  Effect now skips `contains` in dialects that do not have it (draft-04), as Zod does, so a schema whose ignored `contains` subschema Effect cannot express no longer fails to generate.

- 19536a4: Add `externalSchemas` so absolute `$ref` URIs can be served from memory instead of disk or the network. The parser indexes identifiers declared inside a provided document (`$id`, or the draft-04 `id`), and the three `compile()` and `compileSchema()` APIs pass the option through.
- d99505f: Keep the document root when the root is a `$ref`. `parse()` resolved the root pointer with `$refs.get('#')`, so `root` was the referenced value and `root[Meta]` described that value instead of the document. Generated code now emits the root as an alias to the referenced declaration instead of inlining or merging the target, and `referencedSchemas` no longer includes the root document.

### Patch Changes

- 83be704: Add `narrowUntypedSchema`, the helper both runtime generators use to narrow a
  subschema to the type of the value it is applied to (`propertyNames`, schema
  dependencies and `not`/`if`/`then`/`else`). The Zod generator now calls it
  instead of keeping its own copy, so the exclusion list and the type-specific
  keyword gate cannot drift between the packages.

## 0.5.1

### Patch Changes

- 752d60c: Resolve a `$ref` with a JSON pointer fragment, such as `#/definitions/a` or `other.json#/definitions/b`, against the nearest `$id` instead of the root document. A pointer inside an embedded `$id` resource now links to that resource's definition, and a `../` reference from a referenced file is linked. This raises the official draft-07 conformance to 248/271 cases for Zod and 175/288 for TypeScript.

## 0.5.0

### Minor Changes

- 3338340: Resolve `$ref`s against `$id` and `$anchor` identifiers. A relative reference now uses the nearest `$id` as its base URI, fragment-only identifiers such as `#name` resolve to an `$id: "#name"` or `$anchor: "name"` declaration, a sibling `$id` or `$anchor` of a `$ref` follows the dialect (ignored in draft-07 and older, applied in 2019-09 and newer), and draft-04 `id` identifiers are resolved too. This fixes bundled schemas and raises the official draft-07 conformance to 246/271 cases for Zod, 214/269 for Effect Schema and 173/288 for TypeScript.

  Generate `patternProperties` in the Zod and Effect Schema generators. Every matching pattern is validated (including overlapping patterns), while `additionalProperties` applies only to keys that match no pattern.

## 0.4.0

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

- 3e62e0e: Export `withSourceMeta` and `ANNOTATION_KEYWORDS` for generators.

  `withSourceMeta(source, copy)` keeps the `Meta` of a node, and with it the
  node's dialect, on a shallow copy made while generating code. `ANNOTATION_KEYWORDS`
  lists the keywords that never constrain a value; the parser uses it to decide
  which `$ref` siblings to report, and the generators use it to split a node's
  constraints from its annotations.

## 0.3.0

### Minor Changes

- ff39a85: Map 2019-09/2020-12 `unevaluatedProperties` and `unevaluatedItems` to `additionalProperties` and the items rest instead of failing, keep `deprecated` in the generated `.meta()`, and add a `readOnlyKeyword` option that maps `readOnly: true` to `.readonly()`.

### Patch Changes

- 6ad41a2: Support `$ref` to a boolean schema instead of throwing. `$ref` to `true` emits `z.any()` and `$ref` to `false` emits `z.never()`.
- 5f724d6: Add `utilize-zod` and `utilize-effect` CLIs that compile a JSON or YAML schema from a file, directory, glob or stdin to a file, a directory or stdout. Generated files now start with a "do not edit" banner by default (`bannerComment: false` to omit it). The parser and both `compile()` functions no longer log progress to stdout.

## 0.2.0

### Minor Changes

- a25f59a: Detect the JSON Schema draft from `$schema` and normalize 2019-09 and 2020-12 keywords to the draft-07 model.

### Patch Changes

- a7d3cf0: Ignore non-string `$ref` values when linking, so schemas with a property named `$ref`, such as the draft-07 meta-schema, can be parsed.
- dbefc30: Update the build toolchain and runtime dependencies, and publish ESM builds
  with tsdown.

## 0.1.0

### Minor Changes

- d56dd72: updated external deps

## 0.0.4

### Patch Changes

- 28889b5: added default value for schema parent

## 0.0.3

### Patch Changes

- 8bc03cb: added README

## 0.0.2

### Patch Changes

- 9bf2159: fixed sorting
