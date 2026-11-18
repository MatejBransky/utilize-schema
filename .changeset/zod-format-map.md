---
'@utilize/zod': minor
---

Add a `formatMap` option that maps `format` names to Zod string expressions. Each entry overrides the built-in mapping for that format, so both unknown and known formats can be customized, while formats that are not listed keep the built-in mapping. `minLength`, `maxLength` and `pattern` are still appended.
