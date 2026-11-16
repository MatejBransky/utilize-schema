---
'@utilize/zod': minor
---

Intersect keywords next to `allOf`, `anyOf` and `oneOf` instead of dropping them. A schema such as `{ allOf: [...], properties: {...} }` now rejects data the previous output accepted. `$ref` still overrides its siblings, as draft-07 requires.
