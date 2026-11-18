---
'@utilize/json-schema': minor
---

Export `withSourceMeta` and `ANNOTATION_KEYWORDS` for generators.

`withSourceMeta(source, copy)` keeps the `Meta` of a node, and with it the
node's dialect, on a shallow copy made while generating code. `ANNOTATION_KEYWORDS`
lists the keywords that never constrain a value; the parser uses it to decide
which `$ref` siblings to report, and the generators use it to split a node's
constraints from its annotations.
