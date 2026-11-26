# @utilize/zod

## 0.12.0

### Minor Changes

- 0939ed0: Export the types referenced by exported signatures so consumers can name them: `Writable` and `KeywordIssue` in `@utilize/json-schema`, `ObjectKeys` in `@utilize/effect`, `StandaloneSchemasResult` in `@utilize/typescript`, and the generator predicate, generate and test-option types in `@utilize/zod`. These types were already part of the emitted declarations; the export only makes them importable. The `private-type-leaks` rule now keeps that true.
- bc6133c: Export `UnsupportedCyclicReferenceError` and `UnsupportedPatternError` from `@utilize/zod`, so code that calls the generator can catch them with `instanceof`, as it already can with the errors `@utilize/effect` and `@utilize/typescript` throw.

### Patch Changes

- 72afcad: List the built entry files by name in the `exports` map instead of a `./dist/*` wildcard. `@utilize/zod/dist/index.mjs`, `dist/runtime.mjs`, `dist/cli.mjs` (and `@utilize/json-schema/dist/index.mjs`, `dist/node.mjs`), with their `.d.ts` files, still resolve. Only the bundler's hashed chunk files, whose names change on every build, are no longer importable directly.
- bab16d9: The CLI and the file-reading part of `compile` now come from `@utilize/json-schema/node`, so the three generators no longer keep their own copies, and they no longer depend on `js-yaml` directly. Flags, help text, exit codes, messages and generated files stay the same.
- 41afe47: Add `expectDefined` for replacing non-null assertions with a throwing invariant, and narrow the Zod runtime helpers with it.
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

## 0.11.1

### Patch Changes

- f012b77: Bump js-yaml from 5.4.2 to 5.5.0.

## 0.11.0

### Minor Changes

- 00cd219: Support `minContains` and `maxContains` in the runtime generators. The parser no longer rejects them, and both generators count the items matching `contains`, applying the bounds only in 2019-09 and newer. `minContains: 0` allows an array without a match, and both keywords are ignored without `contains`. A plain `contains` keeps its single-match check and its message.

  Zod also compiles `pattern` and `patternProperties` regular expressions in Unicode mode, so property escapes such as `\p{Letter}` match as the specification expects. A pattern that is not valid in Unicode mode (`\-`, `a{`, ...) now fails at generation time with an error that names the keyword and the pattern, instead of crashing while emitting code.

  Effect now skips `contains` in dialects that do not have it (draft-04), as Zod does, so a schema whose ignored `contains` subschema Effect cannot express no longer fails to generate.

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

- 83be704: Add `narrowUntypedSchema`, the helper both runtime generators use to narrow a
  subschema to the type of the value it is applied to (`propertyNames`, schema
  dependencies and `not`/`if`/`then`/`else`). The Zod generator now calls it
  instead of keeping its own copy, so the exclusion list and the type-specific
  keyword gate cannot drift between the packages.
- b17a201: Validate `__proto__` and other `Object.prototype` property names instead of letting Zod read the prototype chain. A `__proto__` property is emitted as a computed key and checked on the raw input (including `required`, `patternProperties`, `additionalProperties`, records and `const`/`enum` object values, since Zod's object and record parsers skip it). Object schemas that declare or require `toString`, `constructor` and similar names get a null-prototype clone of the input, so an absent key is no longer validated against the inherited value and is reported as missing when required. This fixes the two draft-07 prototype-name suite cases. The generated code relies on Zod 4.5's handling of a computed `__proto__` key, so the peer range is now `>=4.5.0 <5` instead of `>=4.0.0 <5`.
- 5e0d94e: Apply keywords on a schema without `type` for every type they constrain. Each constrained type now gets its own guarded check, so `{ minLength: 2, minimum: 5 }` validates strings and numbers instead of falling back to `z.unknown()`, which accepted every value.
- Updated dependencies [00cd219]
- Updated dependencies [19536a4]
- Updated dependencies [d99505f]
- Updated dependencies [83be704]
  - @utilize/json-schema@0.6.0

## 0.10.0

### Minor Changes

- e4fed99: Declare a repeated inline subschema once. An inline subschema with subschemas of its own (properties, items or a combinator) that appears more than once and is not identical to a named schema is now generated as its own `export const` and referenced wherever it appears, instead of being generated again at every place. The declaration is named by its `$id` or `title`, else after the place it first appears (e.g. `TagsItem` for the items of a `tags` property), takes a numeric suffix when a named schema already has that name, and goes through `customNameResolver`, `schemaName` and `typeName` like any other declaration. Generated code that repeated such a subschema now exports one more schema and type for it.
- 6da93fd: Generate less redundant code. A `const` or `enum` next to a `type` it already satisfies (e.g. `{ "type": "string", "const": "a" }`) is only a literal, a `type` list puts its `description` and other annotations on the union once, and an `anyOf` with a branch that accepts every value (e.g. `[X, {}]`) is left out. That `anyOf` never rejected a value and its keys were never in the inferred type, but note that `.parse()` no longer keeps the properties only `X` described (an object next to it strips them like any other unknown key) and defaults inside `X` no longer apply. A `oneOf` whose branches cannot match the same value (different `const`/`enum` values, different types, or tagged objects) becomes a plain `z.union()`, which `z.toJSONSchema()` can convert. An inline subschema identical to a named schema is generated as a reference to it. The new `runtimeImport` option (CLI: `--runtime-import`) imports the `oneOfSchema` helper from `@utilize/zod/runtime`, which the package now exports, instead of declaring it in every file. The package now has an `exports` map: the main entry, `./runtime` and `./dist/*` can be imported or required, other deep paths cannot.

### Patch Changes

- 752d60c: Resolve a `$ref` with a JSON pointer fragment, such as `#/definitions/a` or `other.json#/definitions/b`, against the nearest `$id` instead of the root document. A pointer inside an embedded `$id` resource now links to that resource's definition, and a `../` reference from a referenced file is linked. This raises the official draft-07 conformance to 248/271 cases for Zod and 175/288 for TypeScript.
- 52f2989: Fix the value type of a recursive schema when a draft-07 `$ref` has a `const`, `enum` or combinator plus another keyword next to it. Draft-07 ignores those keywords and the generated schema already did, but the value type still included them (e.g. `'a' & Kind`), so the generated file failed to type-check. In 2019-09 and newer the keywords still apply to both.
- Updated dependencies [752d60c]
  - @utilize/json-schema@0.5.1

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
