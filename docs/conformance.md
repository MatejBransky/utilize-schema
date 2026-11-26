# Conformance comparison

This page compares the conformance numbers of the generators in this repository
with
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript),
the project this repository started from. Read it as **a description of what
each project measures**, not as a ranking: the tools emit different artifacts
and their numbers are not directly comparable.

Every project here runs the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite).

## How each project measures conformance

**Utilize Schema (`@utilize/zod`)** generates runtime Zod schemas. A test case
passes when every spec-valid instance is accepted and every spec-invalid one is
rejected. Draft-07 baseline on suite commit `e2a68a1`:

- 304 of 304 cases (1,655 of 1,655 assertions).
- Cases that need external schemas are served from memory through
  `externalSchemas`. Format cases run in the mode they are tagged for:
  `format-annotation` with `formatMode: 'annotate'`, `format-assertion` with
  `formatMode: 'assert'`.

**Utilize Schema (`@utilize/typescript`)** generates TypeScript types and uses
the same type-level method as json-schema-to-typescript: every suite instance is
emitted as a typed constant and one `tsc --strict` pass decides acceptance. This
is the closest comparison on this page, although the suite revisions differ.
Draft-07 baseline on suite commit `e2a68a1`:

- 192 of 285 cases have no valid instance rejected and no invalid instance
  accepted.
- 81 cases differ only because an invalid instance is accepted by a keyword a
  type cannot express (`minimum`, `pattern`, `format`, `uniqueItems`, …).
- 12 cases are listed in `test/suite/knownGaps.ts`: inference gaps where an
  untyped schema is rejected for a JSON type its keywords do not constrain.
- Across instances it accepts 559 of 585 spec-valid instances and rejects 236 of
  387 spec-invalid ones.

See
[`packages/typescript/README.md`](../packages/typescript/README.md#conformance)
for the methodology; the side-by-side record is
[below](#compared-with-json-schema-to-typescript).

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

## Compared with json-schema-to-typescript

At its own pinned revision (`5caacfc`, suite `3c25e5f`) json-schema-to-typescript
records 141 of 257 draft-07 groups with no valid instance rejected and no invalid
one accepted, 24 crashes and 2 invalid TypeScript files. Its instance totals are
490 of 516 valid accepted and 198 of 342 invalid rejected. The suite revisions
and case selections differ (257 groups there, 285 runnable cases here; this
runner serves `externalSchemas` from memory), so the numbers describe two
different records rather than a score. On the same group metric the TypeScript
generator is ahead (67.4% vs 54.9%), accepts more valid instances (95.6% vs
95.0%), emits no invalid TypeScript and crashes on 2 cases the shared parser or
`$ref` resolver cannot resolve (24 there). Instance-level invalid rejection is
not comparable across the two revisions: this runner rejects 61.0% of 387
invalid instances, json-schema-to-typescript 57.9% of its 342, largely because
the newer suite revision adds many more `format` cases that a type cannot
reject.

## Why the numbers are not directly comparable

1. **Runtime validation vs. compile-time types.** TypeScript cannot express
   `minimum`, `pattern`, `uniqueItems`, `format`, `dependencies` or
   `if`/`then`/`else`. Instances invalid for those reasons are accepted by any
   type the generator could emit, so a type-level check has a lower ceiling by
   construction. The json-schema-to-typescript conformance README says the same:
   the baseline is "not a claim that the numbers are right; it is a record of
   what master does".
2. **Different suite revisions.** The numbers come from different pinned
   revisions with different group counts (257 draft-07 groups there, 304
   runnable cases for Zod and 285 for TypeScript here).
3. **Different case selection.** The type-level runner skips the 19
   `format-assertion` cases and serves `externalSchemas` from memory;
   json-schema-to-typescript runs every draft-07 group and serves remote
   references from the suite's `remotes/` directory.

## What a fair comparison would need

Run every tool against the same suite revision, keep only the cases whose
outcome a TypeScript type can express, and compare the same metric.
`@utilize/typescript` is that comparison for the type-level metric at its pinned
revision; this page records both numbers. Until the revisions match, read the
numbers above as different records, not as a score.

## Reproducing

- Utilize Schema: `pnpm --filter @utilize/zod test:suite`
- Utilize Schema (type level): `pnpm --filter @utilize/typescript test:suite`
- json-schema-to-typescript: `bun run build:server && node test/conformance/run.js`
  at its pinned suite commit.
