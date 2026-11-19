---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': minor
---

Keep the document root when the root is a `$ref`. `parse()` resolved the root pointer with `$refs.get('#')`, so `root` was the referenced value and `root[Meta]` described that value instead of the document. Generated code now emits the root as an alias to the referenced declaration instead of inlining or merging the target, and `referencedSchemas` no longer includes the root document.
