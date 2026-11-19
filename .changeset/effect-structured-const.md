---
'@utilize/effect': minor
---

Compare `const` and `enum` values structurally instead of rejecting objects and arrays. Effect has no literal form for them, so a structured value is emitted as a `Schema.Json` filter that compares canonical JSON, and the declaration gets an explicit value type with the literal shape. Comparison ignores key order and keeps JSON types distinct (`[false]` does not match `[0]`). This fixes 12 draft-07 suite cases.
