---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
---

Support `minContains` and `maxContains` in the runtime generators. The parser no longer rejects them, and both generators count the items matching `contains`, applying the bounds only in 2019-09 and newer. `minContains: 0` allows an array without a match, and both keywords are ignored without `contains`.

Zod also compiles `pattern` and `patternProperties` regular expressions in Unicode mode, so property escapes such as `\p{Letter}` match as the specification expects.
