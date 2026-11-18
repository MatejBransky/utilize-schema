---
'@utilize/zod': minor
'@utilize/effect': minor
'@utilize/typescript': minor
---

Add an optional `format(code)` hook to `compile()`, `compileFile()` and `compileSchema()`. The formatter may be synchronous or asynchronous, so consumers can run Prettier (or another formatter) over the generated code before the banner is prepended.
