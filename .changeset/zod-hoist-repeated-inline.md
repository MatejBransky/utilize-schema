---
'@utilize/zod': minor
---

Declare a repeated inline subschema once. An inline subschema with subschemas of its own (properties, items or a combinator) that appears more than once and is not identical to a named schema is now generated as its own `export const` and referenced wherever it appears, instead of being generated again at every place. The declaration is named by its `$id` or `title`, else after the place it first appears (e.g. `TagsItem` for the items of a `tags` property), takes a numeric suffix when a named schema already has that name, and goes through `customNameResolver`, `schemaName` and `typeName` like any other declaration. Generated code that repeated such a subschema now exports one more schema and type for it.
