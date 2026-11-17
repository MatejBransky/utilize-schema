---
'@utilize/typescript': minor
---

Add `@utilize/typescript`, a JSON Schema to TypeScript generator. It emits one interface or type alias per standalone schema, turns objects into interfaces, `allOf` into intersections, `anyOf`/`oneOf` into unions and `enum`/`const` into literal types, supports local, external and recursive `$ref`s, maps `additionalProperties` and `patternProperties` to index signatures, and rejects cycles TypeScript cannot express. It has no runtime dependency and is a drop-in alternative to `json-schema-to-typescript`.

The generator is checked against the official JSON Schema Test Suite (draft-07) at the type level: every suite instance is emitted as a typed constant and one `tsc --strict` run decides whether valid instances are accepted and invalid ones rejected. The current baseline is 164 of 288 cases, with 746 of 813 valid instances accepted and 210 of 788 invalid instances rejected; the record and the known gaps live in `test/suite/`.
