# Conformance comparison

This page compares the compliance numbers of the generators in this repository
with
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript),
the project this repository started from.

Every project here runs the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).
The runtime generators are validated with values; the two type-level generators
are measured with the compiler.

## Runtime generators

`@utilize/zod` and `@utilize/effect` generate runtime validators. Both pass every
draft-04, draft-06 and draft-07 case in the pinned suite (`e2a68a1`):

| Dialect   |         Zod cases |      Effect cases |
| --------- | ----------------: | ----------------: |
| draft-04  |         194 / 194 |         194 / 194 |
| draft-06  |         263 / 263 |         263 / 263 |
| draft-07  |         304 / 304 |         304 / 304 |
| 2019-09   |         377 / 417 |         375 / 417 |
| 2020-12   |         376 / 431 |         374 / 431 |
| **Total** | **1,514 / 1,609** | **1,510 / 1,609** |

Format cases run in the mode they are tagged for: `format-annotation` with
`formatMode: 'annotate'`, `format-assertion` with `formatMode: 'assert'`. Cases
that need external schemas are served from memory through `externalSchemas`.

The remaining gaps are dynamic/recursive references, full `unevaluated*`
annotation propagation, and a few vocabulary/annotation cases.

The per-dialect numbers are recorded in
[`packages/zod/test/suite/baseline.ts`](../packages/zod/test/suite/baseline.ts)
and
[`packages/effect/test/suite/baseline.ts`](../packages/effect/test/suite/baseline.ts).

## Type-level comparison

`@utilize/typescript` and json-schema-to-typescript are measured the same way:

- The same pinned suite revision (`e2a68a1`) and the same dialect set:
  draft-04, draft-06, draft-07, 2019-09 and 2020-12.
- The same case selection: `format-assertion` cases are skipped because a type
  cannot check a format either way.
- The same method: every instance is emitted as a typed constant next to the
  generated declarations, and one `tsc --strict` run decides acceptance.
- The same external references: `externalSchemas` are served from memory.
- The same metric: a case passes when no spec-valid instance is rejected and no
  spec-invalid instance is accepted.

json-schema-to-typescript is pinned to `16.0.0` and its baseline lives in
[`packages/test-utils/src/suite/jsonSchemaToTypescriptBaseline.ts`](../packages/test-utils/src/suite/jsonSchemaToTypescriptBaseline.ts).

| Dialect  | `@utilize/typescript` cases | json-schema-to-typescript cases | `@utilize/typescript` instances | json-schema-to-typescript instances |
| -------- | --------------------------- | ------------------------------- | ------------------------------- | ----------------------------------- |
| draft-04 | 115 / 187 (61%)             | 78 / 187 (41%)                  | 526 / 672 (78%)                 | 400 / 672 (59%)                     |
| draft-06 | 169 / 253 (66%)             | 110 / 253 (43%)                 | 712 / 878 (81%)                 | 524 / 878 (59%)                     |
| draft-07 | 192 / 285 (67%)             | 113 / 285 (39%)                 | 795 / 972 (81%)                 | 549 / 972 (56%)                     |
| 2019-09  | 243 / 396 (61%)             | 132 / 396 (33%)                 | 988 / 1,292 (76%)               | 689 / 1,292 (53%)                   |
| 2020-12  | 237 / 409 (57%)             | 123 / 409 (30%)                 | 996 / 1,319 (75%)               | 665 / 1,319 (50%)                   |

The case counts match because both runners select exactly the same cases. The
difference is in how each generator spends its failures:

- `@utilize/typescript` has more **type gaps**: cases where the only difference
  is an invalid instance accepted by a keyword TypeScript cannot express
  (`minimum`, `pattern`, `format`, `uniqueItems`, dependencies, `if`/`then`/
  `else`).
- json-schema-to-typescript has more **structural gaps**: crashes, invalid
  TypeScript, or a spec-valid instance rejected by the generated type. A large
  share comes from its inference rule: a schema with only a scalar or object
  keyword but no `type` (for example `{ maximum: 3 }`) becomes an object type,
  so valid numbers and strings are rejected. `@utilize/typescript` keeps such a
  schema as `unknown`.

Which trade-off is preferable depends on the schemas you feed it, but the
measurement itself is now like for like.

## Why the runtime numbers are not directly comparable

Runtime validation and a TypeScript type answer different questions. A type
cannot express `minimum`, `pattern`, `uniqueItems`, `format`, `dependencies` or
`if`/`then`/`else`, so a type-level runner has a lower ceiling by construction.
The runtime generators are also scored from the dialect's full case set,
including the format-assertion cases that the type-level runners skip.

## Reproducing

- Runtime generators:
  `pnpm --filter @utilize/zod test:suite` and
  `pnpm --filter @utilize/effect test:suite`
- `@utilize/typescript`: `pnpm --filter @utilize/typescript test:suite`
- json-schema-to-typescript:
  `pnpm --filter @utilize/test-utils test:suite`
- Update the competitor baseline after a dependency or suite update:
  `pnpm --filter @utilize/test-utils update:suite-baseline`
- Regenerate the badges from every baseline: `pnpm badge:suite`
