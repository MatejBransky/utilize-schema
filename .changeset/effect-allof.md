---
'@utilize/effect': minor
---

Merge `allOf` subschemas that constrain one scalar type, and handle boolean, empty and nested members. Bounds (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`) combine into the strictest one, `true` and empty members are ignored, `false` rejects everything, and nested `allOf` is flattened. Applicators (`anyOf`, `oneOf`) and any other member that cannot be merged are applied as `Schema.makeFilter` checks over each member, so every combination the generator can express is supported. `additionalProperties` declared by one member is not merged with properties declared by another, and a checked reference next to `allOf` is wrapped in a union because Effect cannot add checks to `Schema.suspend`. This fixes 26 draft-07 suite cases.
