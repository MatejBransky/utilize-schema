---
'@utilize/typescript': minor
---

Add opt-in `inferFormatAsString` (and `--infer-format-as-string`) to treat a
schema with `format` and no inferred object or array shape as `string` instead
of `unknown`. The default is unchanged because `format` only applies to strings;
without `type`, non-string instances remain valid.
