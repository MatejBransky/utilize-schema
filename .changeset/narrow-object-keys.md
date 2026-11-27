---
'@utilize/typescript': minor
---

Emit narrower object keys for `propertyNames` and `patternProperties`. A
`propertyNames` `enum` or `const` becomes a mapped key type, and a
`patternProperties` pattern made of literals, character classes and alternation
becomes a template-literal key type, including the `${string}` open side of an
unanchored pattern. Patterns a type cannot express keep the index signature.
