---
'@utilize/zod': patch
---

Validate `__proto__` and other `Object.prototype` property names instead of letting Zod read the prototype chain. A `__proto__` property is emitted as a computed key and checked on the raw input (including `required`, `patternProperties`, `additionalProperties`, records and `const`/`enum` object values, since Zod's object and record parsers skip it). Object schemas that declare or require `toString`, `constructor` and similar names get a null-prototype clone of the input, so an absent key is no longer validated against the inherited value and is reported as missing when required. This fixes the two draft-07 prototype-name suite cases. The generated code relies on Zod 4.5's handling of a computed `__proto__` key, so the peer range is now `>=4.5.0 <5` instead of `>=4.0.0 <5`.
