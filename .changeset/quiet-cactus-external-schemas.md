---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': minor
---

Add `externalSchemas` so absolute `$ref` URIs can be served from memory instead of disk or the network. The parser indexes identifiers declared inside a provided document (`$id`, or the draft-04 `id`), and the three `compile()` and `compileSchema()` APIs pass the option through.
