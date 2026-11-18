---
'@utilize/zod': minor
---

Add a `formatMap` option that replaces the built-in `format` to Zod mapping. Values are Zod string expressions, so unknown formats and known formats can be customized, and `minLength`, `maxLength` and `pattern` are still appended.
