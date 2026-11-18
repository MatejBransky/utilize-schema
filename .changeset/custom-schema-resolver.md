---
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': minor
---

Add a `customSchemaResolver(schema)` option to all three generators. It returns an expression for a matching schema node and bypasses the built-in generator, so callers can map formats, keywords or whole schemas to a Zod expression, an Effect Schema expression or a TypeScript type. Returning `undefined` keeps the default behavior.
