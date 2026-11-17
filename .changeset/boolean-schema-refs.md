---
'@utilize/effect': patch
'@utilize/json-schema': patch
'@utilize/zod': patch
---

Support `$ref` to a boolean schema instead of throwing. `$ref` to `true` emits `z.any()` and `$ref` to `false` emits `z.never()`.
