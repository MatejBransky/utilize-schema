---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
---

Resolve and validate the JSON Schema dialect per resource.

`$schema` is now read at every schema resource (the document root and every
subschema with a non-fragment `$id`), and the resolved dialect is copied into
`Meta.dialect` / `Meta.dialectSource`. Keywords that do not belong to the
node's dialect are reported as warnings and ignored by default instead of being
applied to generated code. `parse()` and `compile()` accept `dialect`,
`fallbackDialect`, `unknownDialect`, `keywordPolicy` and `onDialectIssue`;
`keywordPolicy: 'error'` fails on such keywords, `'ignore'` drops them silently
as the specification requires. An unrecognized `$schema` now falls back to
`fallbackDialect` instead of failing; pass `unknownDialect: 'error'` to reject
it. The `utilize-zod` and `utilize-effect` CLIs expose the same options.
