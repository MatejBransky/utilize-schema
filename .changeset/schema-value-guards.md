---
'@utilize/json-schema': minor
'@utilize/zod': minor
---

Add `isJSONSchema`, `isJSONSchemaObject`, `isParsedJSONSchema` and `isParsedJSONSchemaObject` runtime guards so callers can narrow raw and linked schema values without unsafe type assertions, plus `reachesThrough` for shared graph traversal. Export the schema shapes the Zod generator predicates narrow to, so the generator constants no longer leak private types.
