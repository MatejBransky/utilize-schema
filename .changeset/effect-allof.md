---
'@utilize/effect': minor
---

Merge `allOf` subschemas that constrain one scalar type, and handle boolean, empty and nested members. Bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`) combine into the strictest one, `true` and empty members are ignored, `false` rejects everything, and nested `allOf` is flattened. Applicators (`anyOf`, `oneOf`) and scalar members that cannot be merged are applied as `Schema.makeFilter` checks over each member, and non-scalar members that cannot be merged still fail with `UnsupportedEffectSchemaFeatureError`. This fixes 20 draft-07 suite cases.
