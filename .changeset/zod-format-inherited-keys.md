---
'@utilize/zod': patch
---

Treat a `format` named after a built-in object key, such as `constructor` or `toString`, as an unknown format. It used to emit the source of a JavaScript function instead of a Zod schema.
