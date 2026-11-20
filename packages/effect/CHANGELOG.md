# @utilize/effect

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
