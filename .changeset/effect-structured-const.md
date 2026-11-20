---
'@utilize/effect': minor
---

Compare `const` and `enum` values structurally instead of rejecting objects and
arrays. Effect has no literal form for them, so a structured value is emitted as
a `Schema.Json` filter that compares canonical JSON. The helper takes the
literal's type as a parameter, so a nested literal in a recursive schema still
matches the annotation of the declaration. Comparison ignores key order and
keeps JSON types distinct (`[false]` does not match `[0]`). This fixes 12
draft-07 suite cases.
