---
'@utilize/json-schema': minor
---

Export `collectStandaloneSchemas`, `childSchemasOf` and the `SchemaEdge` type. The generators each had their own copy of this code; they now share this one. `collectStandaloneSchemas` finds every schema that gets its own declaration (the root, `$defs`/`definitions` entries and `$ref` targets) and the dependency edges between them. The `inlineCopies` and `definitionsOf` options let a generator treat inline copies as references or read definitions its own way.
