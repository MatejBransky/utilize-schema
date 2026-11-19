---
'@utilize/json-schema': patch
'@utilize/zod': patch
---

Add `narrowUntypedSchema`, the helper both runtime generators use to narrow a
subschema to the type of the value it is applied to (`propertyNames`, schema
dependencies and `not`/`if`/`then`/`else`). The Zod generator now calls it
instead of keeping its own copy, so the exclusion list and the type-specific
keyword gate cannot drift between the packages.
