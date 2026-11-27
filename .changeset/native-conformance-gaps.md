---
"@utilize/json-schema": minor
"@utilize/zod": minor
"@utilize/effect": minor
"@utilize/typescript": patch
---

Fix native JSON Schema conformance gaps without introducing a custom runtime: resolve draft-04 legacy `id` references, align UUID/duration/hostname format semantics with the specification, and handle Effect `dependentRequired`/`dependentSchemas` on objects without an explicit `type`.
