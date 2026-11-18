---
'@utilize/zod': patch
---

Fix the value type of a recursive schema when a draft-07 `$ref` has a `const`, `enum` or combinator plus another keyword next to it. Draft-07 ignores those keywords and the generated schema already did, but the value type still included them (e.g. `'a' & Kind`), so the generated file failed to type-check. In 2019-09 and newer the keywords still apply to both.
