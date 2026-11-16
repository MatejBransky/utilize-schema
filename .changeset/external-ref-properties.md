---
'@utilize/json-schema': patch
---

Ignore non-string `$ref` values when linking, so schemas with a property named `$ref`, such as the draft-07 meta-schema, can be parsed.
