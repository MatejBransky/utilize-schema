---
'@utilize/zod': patch
---

Emit a `__proto__` property as a computed key and validate declared and required `__proto__` values against the raw input, because Zod's object parser skips that key. A declared `__proto__` no longer sets the prototype of the generated shape, and its type and `required` are now enforced.
