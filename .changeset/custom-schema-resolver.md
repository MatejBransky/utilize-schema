---
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': minor
---

Add a `customSchemaResolver(schema)` option to all three generators and their `compile()` functions. It is called for every object schema node, including `$ref` nodes and each type of a `type` list, and returns a Zod expression, an Effect Schema expression or a TypeScript type that replaces the node, so callers can map formats, keywords or whole schemas. Returning `undefined` keeps the default behavior. In Zod and Effect the expression replaces the whole node, so no metadata, default or annotations are added to it; the TypeScript generator keeps the node's JSDoc. Inside a recursive schema the generated value type types a replaced node as `unknown`. `@utilize/effect` and `@utilize/typescript` export the `CustomSchemaResolver` type like `@utilize/zod`.
