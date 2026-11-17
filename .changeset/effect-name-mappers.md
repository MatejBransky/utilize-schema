---
'@utilize/effect': minor
---

Add `schemaName` and `typeName` options to `generate()` and `compile()`. Each is a callback that receives the name resolved for a standalone schema (`$id`, `title`, the `$defs` key or the file name) and returns the name to emit, so appending a `Schema` suffix is `(name) => name + 'Schema'`. Both default to the resolved name, a mapped name keeps its casing when it is already a valid identifier and is turned into one otherwise. Mapped names never take another schema's name, and every `$ref` points at the renamed schema variable.
