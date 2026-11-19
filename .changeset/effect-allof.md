---
'@utilize/effect': minor
---

Merge `allOf` subschemas that constrain one scalar type, and handle boolean, empty and nested members. Bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`) combine into the strictest one, `true` and empty members are ignored, `false` rejects everything, and nested `allOf` is flattened. Patterns and different `multipleOf` values that cannot be combined still fail with `UnsupportedEffectSchemaFeatureError`. This fixes 19 draft-07 suite cases.
