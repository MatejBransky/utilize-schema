---
'@utilize/json-schema': patch
'@utilize/zod': patch
'@utilize/typescript': patch
---

Resolve a `$ref` with a JSON pointer fragment, such as `#/definitions/a` or `other.json#/definitions/b`, against the nearest `$id` instead of the root document. A pointer inside an embedded `$id` resource now links to that resource's definition, and a `../` reference from a referenced file is linked. This raises the official draft-07 conformance to 248/271 cases for Zod and 175/288 for TypeScript.
