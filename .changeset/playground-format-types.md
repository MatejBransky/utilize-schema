---
'@utilize/json-schema': patch
'@utilize/zod': patch
'@utilize/effect': patch
---

Keep UUID validation in the shared runtime entry and preserve generated field
types in the playground.

The playground now registers declarations for `@utilize/json-schema/formats`,
so Monaco resolves imported validators instead of falling back to `any`.

Zod and Effect schemas import every JSON Schema-specific format check from the
shared entry. UUID, JSON Pointer, URL and the pattern-based Effect formats no
longer emit inline regexes; target-native helpers such as `z.url()` stay native.
