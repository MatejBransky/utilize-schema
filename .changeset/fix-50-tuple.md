---
'@utilize/zod': patch
---

Emit required tuple items up to `minItems` and drop `.rest()` and the redundant length check when `maxItems` fixes the length, so fixed-size arrays infer `[T, T]` instead of `[T?, T?, ...unknown[]]`.
