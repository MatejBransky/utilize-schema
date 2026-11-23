# @utilize/json-schema

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
