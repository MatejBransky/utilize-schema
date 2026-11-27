---
'@utilize/json-schema': minor
'@utilize/effect': minor
'@utilize/typescript': minor
'@utilize/zod': minor
---

Add opt-in JSON Schema validation before generation. `parse` and every
`compile` accept a `validateSchema` callback that receives each resolved
document together with the dialect the parser resolved for it, and a finding
throws `SchemaValidationError` with one report per document.

The CLIs gain `--validate`, which checks every document (including `$ref`
targets) against the meta-schema of its dialect — draft-04, draft-06, draft-07,
2019-09 or 2020-12 — and writes nothing when a schema is invalid. Ajv backs the
built-in validator and is an optional peer dependency; `--validator <module>`
replaces it with any function, so Ajv stays out of the install for callers that
do not validate. Draft-04 schemas also need `ajv-draft-04`.

`@utilize/json-schema` exports the adapter as the new `./validate/ajv` entry and
the validation API from the main entry: `SchemaValidator`, the finding, context
and report types, `SchemaValidationError`, and `resolveDocumentDialect`, which
resolves a document's dialect the way `parse` does.
