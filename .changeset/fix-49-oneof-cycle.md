---
'@utilize/zod': patch
---

Anchor cycles on inline object and array nodes, so a recursive `oneOf` through an object property holding an array compiles and infers a recursive type.
