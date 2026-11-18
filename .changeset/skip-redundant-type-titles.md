---
'@utilize/typescript': patch
---

Skip the declaration JSDoc title when it only repeats the generated type name. `title: 'Address'` no longer emits `/** Address */` above `export interface Address`, while titles that add information beyond the name are kept.
