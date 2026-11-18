---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': patch
---

Resolve `$ref`s against `$id` and `$anchor` identifiers. A relative reference now uses the nearest `$id` as its base URI, fragment-only identifiers such as `#name` resolve to an `$id: "#name"` or `$anchor: "name"` declaration, a sibling `$id` or `$anchor` of a `$ref` follows the dialect (ignored in draft-07 and older, applied in 2019-09 and newer), and draft-04 `id` identifiers are resolved too. This fixes bundled schemas and raises the official draft-07 conformance to 246/271 cases for Zod, 213/269 for Effect Schema and 173/288 for TypeScript.

Generate `patternProperties` in the Zod and Effect Schema generators. Every matching pattern is validated (including overlapping patterns), while `additionalProperties` applies only to keys that match no pattern.
