---
'@utilize/zod': minor
---

Enforce the `uniqueItems`, `minProperties` and `maxProperties` keywords instead of silently dropping them. These constraints now reject data that the previous output accepted, so the bump is minor rather than a patch.
