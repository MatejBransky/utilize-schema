---
'@utilize/effect': minor
'@utilize/json-schema': minor
'@utilize/typescript': minor
'@utilize/zod': minor
---

Export the types referenced by exported signatures so consumers can name them: `Writable` and `KeywordIssue` in `@utilize/json-schema`, `ObjectKeys` in `@utilize/effect`, `StandaloneSchemasResult` in `@utilize/typescript`, and the generator predicate, generate and test-option types in `@utilize/zod`. These types were already part of the emitted declarations; the export only makes them importable. The `private-type-leaks` rule now keeps that true.
