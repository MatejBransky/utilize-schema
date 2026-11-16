---
'@utilize/zod': patch
---

break cyclic $refs at object properties; cycles that cannot be deferred with a getter now fail at generation instead of producing code that throws at import
