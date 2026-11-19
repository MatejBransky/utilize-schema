---
'@utilize/zod': patch
---

Apply keywords on a schema without `type` for every type they constrain. Each constrained type now gets its own guarded check, so `{ minLength: 2, minimum: 5 }` validates strings and numbers instead of falling back to `z.unknown()`, which accepted every value.
