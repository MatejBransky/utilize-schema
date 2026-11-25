---
'@utilize/json-schema': patch
---

Drop the unused `dequal` and `moize` dependencies. Nothing imports them, so installing any generator now downloads four fewer packages (`dequal`, `moize` and its `fast-equals` and `micro-memoize`).
