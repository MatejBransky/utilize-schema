---
'@utilize/zod': minor
'@utilize/effect': minor
---

Apply `$ref` siblings and keyword shapes according to the schema dialect.

In draft-04/06/07 a `$ref` ignores every keyword next to it, while 2019-09 and
2020-12 apply them. Zod now emits `z.intersection(reference, siblings)` for the
latter, and both generators stop applying foreign refinements to a `$ref`. Tuple
keywords, `const`, `contains`, `propertyNames`, `if`/`then`/`else`, `dependent*`
and `unevaluated*` only take effect in dialects that define them, so a schema
compiled with `keywordPolicy: 'warn'` or `'ignore'` generates code that matches
the standard instead of being stricter.
