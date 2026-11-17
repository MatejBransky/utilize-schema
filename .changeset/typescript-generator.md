---
'@utilize/typescript': minor
---

Add `@utilize/typescript`, a JSON Schema to TypeScript generator. It emits one interface or type alias per standalone schema, turns objects into interfaces, `allOf` into intersections, `anyOf`/`oneOf` into unions and `enum`/`const` into literal types, supports local, external and recursive `$ref`s, maps `additionalProperties` and `patternProperties` to index signatures, and rejects cycles TypeScript cannot express. It has no runtime dependency and is a drop-in alternative to `json-schema-to-typescript`.
