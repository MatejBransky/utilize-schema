---
'@utilize/json-schema': minor
---

Add `isJSONSchema`, `isJSONSchemaObject`, `isParsedJSONSchema` and `isParsedJSONSchemaObject` runtime guards so callers can narrow raw and linked schema values without unsafe type assertions, plus `reachesThrough` for shared graph traversal.

Type boolean schema documents correctly through `readSchema`, `parseSchemaSource`, `parseForCompile` and each generator's `compileSchema`, share the file-reading and parse paths through `bindCompileFile` and `withParsedSchema`, and export the CLI flag value types used by the public `GeneratorCli` signature. `schemaRecord` now accepts a `JSONSchema` instead of the broad `object`.
