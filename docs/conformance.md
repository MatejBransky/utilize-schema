# Conformance comparison

This page compares the compliance numbers of the generators in this repository
with
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript),
the project this repository started from. The tools emit different artifacts, so
read the numbers as a description of what each project measures, not as a
ranking.

Every project here runs the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).

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

The remaining gaps are dynamic/recursive references and full `unevaluated*`
annotation propagation.

The per-dialect numbers are recorded in
[`packages/zod/test/suite/baseline.ts`](../packages/zod/test/suite/baseline.ts)
and
[`packages/effect/test/suite/baseline.ts`](../packages/effect/test/suite/baseline.ts).

## TypeScript

`@utilize/typescript` generates types and uses the same type-level method as
json-schema-to-typescript: every suite instance is emitted as a typed constant
and one `tsc --strict` pass decides acceptance. Draft-07 baseline on suite commit
`e2a68a1`:

- 192 of 285 cases have no valid instance rejected and no invalid instance
  accepted.
- 81 cases differ only because an invalid instance is accepted by a keyword a
  type cannot express (`minimum`, `pattern`, `format`, `uniqueItems`, …).
- 12 inference gaps are listed in `test/suite/knownGaps.ts`.
- Across instances it accepts 559 of 585 spec-valid instances and rejects 236 of
  387 spec-invalid ones.

See
[`packages/typescript/README.md`](../packages/typescript/README.md#conformance)
for the full methodology and baseline.

## json-schema-to-typescript

json-schema-to-typescript generates TypeScript types and checks them with the
TypeScript compiler. Its conformance runner records a baseline rather than a
pass/fail gate. Draft-07 numbers derived from its committed
`test/conformance/baseline.json` (repository commit `5caacfc`, suite commit
`3c25e5f`):

- 141 of 257 groups have no valid instance rejected and no invalid instance
  accepted.
- 24 groups crash, mostly `$ref` cases, and 2 produce invalid TypeScript.
- Across instances it rejects 26 of 516 spec-valid instances and accepts 144 of
  342 spec-invalid ones.

## Why the numbers differ

The results are not directly comparable. Runtime generators validate values,
while TypeScript can only express types and cannot reject an invalid `minimum`,
`pattern`, `format`, `uniqueItems`, `dependencies` or `if`/`then`/`else`. The
suite revisions also differ: this repository pins suite commit `e2a68a1` with
304 runnable draft-07 cases for the runtime generators, while the type-level
runner skips the 19 `format-assertion` cases and runs 285 cases. The
json-schema-to-typescript numbers come from a different revision of the suite
(`3c25e5f`, 257 groups). Remote references are
served from memory here and from the suite's `remotes/` directory upstream.

Within those limits, the type-level record is explicit: 67.4% of draft-07 cases
pass both ways, 95.6% of spec-valid instances are accepted, 61.0% of spec-invalid
ones are rejected, and no generated TypeScript is invalid.

## Reproducing

- Runtime generators:
  `pnpm --filter @utilize/zod test:suite` and
  `pnpm --filter @utilize/effect test:suite`
- TypeScript: `pnpm --filter @utilize/typescript test:suite`
- json-schema-to-typescript: `bun run build:server && node test/conformance/run.js`
  at its pinned suite commit.
