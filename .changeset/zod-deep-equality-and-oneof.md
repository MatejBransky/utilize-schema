---
'@utilize/zod': minor
---

Compare `const` and `enum` values by deep equality instead of identity: object values become strict objects and array values become exact tuples. Also enforce `oneOf` exactly-one semantics; a value matching several branches is now rejected.
