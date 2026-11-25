---
'@utilize/json-schema': minor
---

Remove the deprecated `SchemaVersion` type and `detectSchemaVersion` helper. Use `DialectId` and `detectDialect` instead: `detectDialect(schema)?.dialect.id ?? fallback` returns the same value as the removed helper. Both aliases were `@deprecated` and the repository still re-exported them, so `deprecated-exports-in-use` reported them as dead API.
