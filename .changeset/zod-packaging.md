---
'@utilize/zod': patch
---

Drop the runtime `lodash` import from `compile()`, make `output` optional in `CompileOptions`, and declare `zod` as a peer dependency instead of a regular one.
