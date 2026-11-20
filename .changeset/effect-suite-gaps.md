---
'@utilize/effect': minor
---

Apply `contains` and `dependencies` to schemas without a `type`, keep the keywords declared next to `anyOf`/`oneOf` (a `type` there is also given to the untyped members, so the decoded type is narrowed to it), count identical `oneOf` branches separately, and emit `__proto__` as a computed key so it does not change the prototype of the generated `Schema.Struct`. This fixes 15 draft-07 suite cases.
