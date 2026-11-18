# @utilize/typescript

## 0.2.0

### Minor Changes

- 67d62a6: Add a `utilize-typescript` CLI. It accepts a schema file, directory or glob, reads JSON and YAML, and writes the generated types to a file, a directory or stdout, with `--cwd` and `--no-banner` flags.

  `compile()` now also reads YAML and prepends the standard "do not edit" banner, and the new `compileFile`, `compileSchema`, `readSchema` and `withBanner` helpers match the other generators.

- 7041555: Add `@utilize/typescript`, a JSON Schema to TypeScript generator. It emits one interface or type alias per standalone schema, turns objects into interfaces, `allOf` into intersections, `anyOf`/`oneOf` into unions and `enum`/`const` into literal types, supports local, external and recursive `$ref`s, maps `additionalProperties` and `patternProperties` to index signatures, and rejects cycles TypeScript cannot express. It has no runtime dependency and is a drop-in alternative to `json-schema-to-typescript`.

  The generator is checked against the official JSON Schema Test Suite (draft-07) at the type level: every suite instance is emitted as a typed constant and one `tsc --strict` run decides whether valid instances are accepted and invalid ones rejected. The current baseline is 167 of 288 cases, with 788 of 814 valid instances accepted and 209 of 788 invalid instances rejected; the record and the known gaps live in `test/suite/`.

### Patch Changes

- aee9c97: Skip the declaration JSDoc title when it only repeats the generated type name. `title: 'Address'` no longer emits `/** Address */` above `export interface Address`, while titles that add information beyond the name are kept.
