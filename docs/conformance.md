# Conformance comparison

This page compares the conformance numbers of the Zod generator with
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript),
the project this repository started from. Read it as **a description of what
each project measures**, not as a ranking: the two tools emit different
artifacts and their numbers are not directly comparable.

Both projects run the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).

## How each project measures conformance

**Utilize Schema (`@utilize/zod`)** generates runtime Zod schemas. A test case
passes when every spec-valid instance is accepted and every spec-invalid one is
rejected. Draft-07 baseline on suite commit `e2a68a1`:

- 233 of 271 cases (1,323 of 1,605 assertions).
- Cases that need external schemas are not wired up yet, and cases tagged
  `format-annotation` are skipped because this generator asserts known formats.

**json-schema-to-typescript** generates TypeScript types and checks them with
the TypeScript compiler: each instance is emitted as a typed constant and the
compiler decides whether the type accepts it. Its conformance runner records a
baseline rather than a pass/fail gate. Draft-07 numbers derived from its
committed `test/conformance/baseline.json` (repository commit `5caacfc`, suite
commit `3c25e5f`):

- 141 of 257 groups have **no** valid instance rejected and **no** invalid
  instance accepted.
- 24 groups crash (mostly `$ref` cases: boolean schemas, `$id`/`$anchor` and
  remote references) and 2 produce invalid TypeScript.
- Across instances it rejects 26 of 516 spec-valid instances and accepts 144 of
  342 spec-invalid ones.

## Why the numbers are not directly comparable

1. **Runtime validation vs. compile-time types.** TypeScript cannot express
   `minimum`, `pattern`, `uniqueItems`, `format`, `dependencies` or
   `if`/`then`/`else`. Instances invalid for those reasons are accepted by any
   type the generator could emit, so a type-level check has a lower ceiling by
   construction. The json-schema-to-typescript conformance README says the same:
   the baseline is "not a claim that the numbers are right; it is a record of
   what master does".
2. **Different suite revisions.** The numbers come from different pinned
   revisions with different group counts (257 draft-07 groups there, 271
   runnable cases here).
3. **Different case selection.** This project skips `format-annotation` cases
   and cases that need external schemas; json-schema-to-typescript runs every
   draft-07 group and serves remote references from the suite's `remotes/`
   directory.

## What a fair comparison would need

Run both tools against the same suite revision, keep only the cases whose outcome
a TypeScript type can express, and compare the same metric. Until then, read the
numbers above as two different records, not as a score.

## Reproducing

- Utilize Schema: `pnpm --filter @utilize/zod test:suite`
- json-schema-to-typescript: `bun run build:server && node test/conformance/run.js`
  at its pinned suite commit.
