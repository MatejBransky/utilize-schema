---
"@utilize/effect": minor
"@utilize/json-schema": minor
"@utilize/typescript": patch
"@utilize/zod": minor
---

Reach full draft-07 conformance in both runtime generators. Zod and Effect now
validate every `format-assertion` case, including RFC 3339 date-time, email and
IDNA hostnames, URI and IRI references, JSON Pointers, regular expressions and
URI Templates. Complex validators are emitted once per generated module.

The parser resolves URNs, tag URIs and other in-document identifiers before an
external read, and both runtime generators handle typeless recursive roots and
tuple references. Generated Zod schemas also support keyword-only object and
array cycles without an explicit `type`. The TypeScript generator inherits the
same reference fixes, raising its draft-07 baseline to 192 of 285 cases.
