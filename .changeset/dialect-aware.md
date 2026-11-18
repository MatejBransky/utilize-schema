---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
---

Resolve and validate the JSON Schema dialect per resource.

`$schema` is now read at every schema resource (the document root and every
subschema with a non-fragment `$id`), and the resolved dialect is copied into
`Meta.dialect` / `Meta.dialectSource`. Keywords that do not belong to the
node's dialect are reported as warnings by default. `parse()` and `compile()`
accept `dialect`, `fallbackDialect`, `unknownDialect`, `keywordPolicy` and
`onDialectIssue`; `keywordPolicy: 'error'` fails on such keywords and `'ignore'`
does not report them. `parse()` also returns the reported issues, and the core
library no longer writes them to the console; the zod and effect `compile()`
functions and CLIs still print them. An unrecognized `$schema` falls back to
`fallbackDialect`; pass `unknownDialect: 'error'` to reject it. The
`utilize-zod` and `utilize-effect` CLIs expose the same options.
