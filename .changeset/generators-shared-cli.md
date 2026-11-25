---
'@utilize/zod': patch
'@utilize/effect': patch
'@utilize/typescript': patch
---

The CLI and the file-reading part of `compile` now come from `@utilize/json-schema/node`, so the three generators no longer keep their own copies, and they no longer depend on `js-yaml` directly. Flags, help text, exit codes, messages and generated files stay the same.
