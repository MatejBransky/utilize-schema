---
'@utilize/effect': minor
---

Add `schemaName` and `typeName` options to `generate()` and `compile()`. Each is a callback that receives the name resolved for a standalone schema (`$id`, `title`, the `$defs` key or the file name) and returns the name to emit, so appending a `Schema` suffix is `(name) => name + 'Schema'`. Both default to the resolved name, mapped names are sanitized into identifiers and kept unique, and every `$ref` suspends a renamed schema variable.
