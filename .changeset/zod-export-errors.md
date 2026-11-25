---
'@utilize/zod': minor
---

Export `UnsupportedCyclicReferenceError` and `UnsupportedPatternError` from `@utilize/zod`, so code that calls the generator can catch them with `instanceof`, as it already can with the errors `@utilize/effect` and `@utilize/typescript` throw.
