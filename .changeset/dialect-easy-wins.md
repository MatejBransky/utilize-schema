---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
---

Support `minContains` and `maxContains` in the runtime generators. The parser no longer rejects them, and both generators count the items matching `contains`, applying the bounds only in 2019-09 and newer. `minContains: 0` allows an array without a match, and both keywords are ignored without `contains`. A plain `contains` keeps its single-match check and its message.

Zod also compiles `pattern` and `patternProperties` regular expressions in Unicode mode, so property escapes such as `\p{Letter}` match as the specification expects. A pattern that is not valid in Unicode mode (`\-`, `a{`, ...) now fails at generation time with an error that names the keyword and the pattern, instead of crashing while emitting code.

Effect now skips `contains` in dialects that do not have it (draft-04), as Zod does, so a schema whose ignored `contains` subschema Effect cannot express no longer fails to generate.
