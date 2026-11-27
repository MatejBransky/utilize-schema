# @utilize/typescript

[![npm version](https://img.shields.io/npm/v/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)
[![Unit test coverage](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/coverage-typescript.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/CONTRIBUTING.md#coverage-badge)

[![draft-04 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-typescript-draft-04.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/typescript/README.md#conformance)
[![draft-06 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-typescript-draft-06.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/typescript/README.md#conformance)
[![draft-07 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-typescript-draft-07.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/typescript/README.md#conformance)
[![2019-09 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-typescript-2019-09.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/typescript/README.md#conformance)
[![2020-12 conformance](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/suite-typescript-2020-12.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/packages/typescript/README.md#conformance)

TypeScript types from JSON Schema: no runtime dependency, no `any`, just the
declarations. The types-only sibling of `@utilize/zod` and `@utilize/effect`, and
a drop-in alternative to
[`json-schema-to-typescript`](https://github.com/bcherny/json-schema-to-typescript)
when you want types without a schema runtime.

- **No runtime, no `any`.** Permissive schemas become `unknown`, so callers have
  to narrow at the boundary.
- **Recursive types are first-class.** Interfaces and deferred aliases; a cycle
  TypeScript cannot express fails with `UnsupportedCircularTypeError`.
- **67% type-level score.** 192 of 285 draft-07 cases; the 81 type gaps are
  keywords a type cannot express, not bugs. 97% line coverage.
- **The output imports nothing.** It compiles with `tsc --strict` as part of CI.

```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  },
  "required": ["email"]
}
```

```ts
export interface User {
  /** @format email */
  email: string;
}
```

```sh
pnpm add -D @utilize/typescript
utilize-typescript user.json user.ts
```

Try it in the
[playground](https://matejbransky.github.io/utilize-schema/?generator=typescript):
open an example, switch between the three generators, and compare the emitted
types with the other two targets.

<details>
<summary>Table of contents</summary>

- [Usage](#usage)
- [CLI](#cli)
- [Output](#output)
- [Keyword coverage](#keyword-coverage)
- [Conformance](#conformance)
- [Differences from json-schema-to-typescript](#differences-from-json-schema-to-typescript)
- [Notes](#notes)

</details>

## Usage

```ts
import { compile } from '@utilize/typescript';

await compile({
  input: './schema.json',
  output: './schema.generated.ts',
});
```

`compile()` accepts `externalSchemas` to serve absolute `$ref` URIs from
memory, `customNameResolver(schema, usedNames)` to rename a
declaration, `customSchemaResolver(schema)` to return a TypeScript type for a
schema node, `validateSchema(schema, { dialect, filePath })` to reject an
invalid document before generation (see
[docs/dialects.md](../../docs/dialects.md#schema-validation)), `inference` to
choose how an untyped schema is narrowed, and `format(code)` to run a synchronous
or asynchronous formatter over the generated code. The default,
`inference: 'spec'`, keeps scalar keywords as `unknown` because they only
constrain one instance type; `inference: 'pragmatic'` reads the keyword family as
the intended type (`format` → `string`, `minimum` → `number`, `contains` →
`array`). The schema resolver is called for every object node
(including `$ref` nodes and the per-type copies of a `type` list, never boolean
schemas) before the built-in renderer. The returned type replaces the node's
type, while its JSDoc comment and the `?` of a non-required property are kept:

```ts
await compile({
  input: './schema.json',
  customSchemaResolver: (schema) => (schema.format === 'date-time' ? 'Date' : undefined),
});
```

Or generate from an already parsed schema:

```ts
import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/typescript';

const { root } = await parse(schema, { cwd: process.cwd(), fileName: 'schema.json' });
const code = generate(root, { inference: 'pragmatic' });
```

`generate()` accepts the same `customNameResolver`, `customSchemaResolver` and
`inference` options.

## CLI

```sh
utilize-typescript schema.json schema.generated.ts
utilize-typescript --input 'schemas/**/*.json' --output generated/
cat schema.yaml | utilize-typescript > schema.generated.ts
```

Input can be a file, a directory or a glob; JSON and YAML are supported. Output
defaults to stdout. Every generated file starts with a "do not edit" banner
(`--no-banner` omits it). `--inference pragmatic` enables the pragmatic
inference described above.

`--validate` checks each resolved document against the meta-schema of its
dialect before generating; install `ajv` to use it (draft-04 schemas also
need `ajv-draft-04`), or pass `--validator <module>` for another validator. See
[docs/dialects.md](../../docs/dialects.md#schema-validation).

## Output

Objects become interfaces, with an index signature unless the schema is closed:

```ts
export interface Person {
  name: string;
  age?: number;
  [key: string]: unknown;
}
```

Enums and `const` become literal unions, filtered and intersected with the
declared type:

```ts
export type Status = 'open' | 'closed';
```

`{ type: 'string', enum: ['ok', 42] }` therefore becomes `'ok'`, because `42`
cannot satisfy `type: 'string'`, and `{ type: 'string', const: 42 }` becomes
`never`.

Recursive schemas work without annotations or ordering constraints:

```ts
export interface Tree {
  name: string;
  children?: Array<Tree>;
  [key: string]: unknown;
}
```

Objects are emitted as interfaces rather than
`type X = Record<string, X>` because TypeScript rejects a mapped type that
refers to its own alias — an interface with an index signature defers the
reference correctly.

## Keyword coverage

Types cover `type`, `const`/`enum`, object members, arrays and tuples,
`allOf`/`anyOf`/`oneOf`, references and JSDoc annotations. Validation-only
keywords such as `minLength` or `pattern` have no type-level equivalent; the
full table is in [docs/keywords.md](../../docs/keywords.md#typescript).

## Conformance

The badges link here. Numbers for every measured dialect live in
[baseline.ts](test/suite/baseline.ts); every dialect is listed case by case.

| Dialect  | Cases passing | Where the gaps are                                                                                                       |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| draft-04 | 122 / 187     | [gaps](test/suite/knownGapCases.ts)                                                                                      |
| draft-06 | 169 / 253     | [gaps](test/suite/knownGapCases.ts)                                                                                      |
| draft-07 | 192 / 285     | [gaps](test/suite/knownGapCases.ts) · [reasons](test/suite/knownGaps.ts) · 81 type gaps (keywords a type cannot express) |
| 2019-09  | 243 / 396     | [gaps](test/suite/knownGapCases.ts)                                                                                      |
| 2020-12  | 237 / 409     | [gaps](test/suite/knownGapCases.ts)                                                                                      |

Which keywords become types is in
[docs/keywords.md](../../docs/keywords.md#typescript). Every dialect is pinned
case by case in `knownGapCases.ts` (structural gaps and the type-gap keys);
draft-07 also has the curated reasons in `knownGaps.ts`.

The generator is checked against the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
(draft-07). A type cannot validate a value, so the runner emits every suite
instance next to the generated declarations as a typed constant and checks the
whole set with one `tsc --strict` run: spec-valid instances must be accepted and
spec-invalid ones rejected.

```sh
pnpm test       # unit tests, including tsc --strict
pnpm test:suite # official JSON Schema Test Suite
```

Current baseline on suite commit `e2a68a1`:

- **192 of 285 cases** pass in both directions.
- **559 of 585** spec-valid instances are accepted.
- **236 of 387** spec-invalid instances are rejected.
- **81 cases** differ only because an invalid instance is accepted. TypeScript
  cannot express `minimum`, `pattern`, `format`, `uniqueItems`, `dependencies`,
  `if`/`then`/`else`, and similar value constraints, so these are inherent to
  the target.
- **12 cases** are listed in `test/suite/knownGaps.ts`: the inference trade-off
  described below.

The numbers are recorded in `test/suite/baseline.ts` and the test fails when
they change, so a regression cannot slip in and an improvement has to update the
baseline on purpose. All five dialects are measured there; the badges at the top
of this README show the conformant case rate per dialect. Every dialect is pinned
case by case in `test/suite/knownGapCases.ts`; draft-07 also has the curated
reasons in `test/suite/knownGaps.ts`.

### Inference trade-off

A schema without `type` infers a shape from structural keywords: `properties`,
`required`, `patternProperties` and `additionalProperties` mean an object,
`items` and `prefixItems` mean an array. This is the same choice
`json-schema-to-typescript` makes, and it keeps common schemas such as
`{ properties: { name: { type: 'string' } } }` useful. Strictly speaking those
keywords only constrain their own JSON type, so a valid `"foo"` is also accepted
by that schema; the generated type rejects it.

Scalar constraints do not infer a type. `maximum` only applies to numbers, so
`{ maximum: 3 }` also accepts `"foo"`; typing it as `number` would reject a
spec-valid instance. A schema that only bounds values therefore stays `unknown`,
which is why the valid-instance rate is above 96% while the object/array shape
inference remains the only source of rejected valid instances in this
generator.

## Differences from json-schema-to-typescript

- **Same pipeline as the other Utilize generators.** Parsing, `$ref` resolution,
  linking and naming are shared, so the three targets agree on what a schema
  means.
- **Cycles are first-class.** Recursive definitions are emitted as recursive
  interfaces, and a cycle with no object or array to defer the reference fails
  with `UnsupportedCircularTypeError` instead of producing invalid TypeScript.
- **`unknown`, never `any`.** A schema that accepts any value is typed as
  `unknown`, which forces a narrowing step at the boundary.
- **Strict output is part of CI.** The generated code is compiled with
  `tsc --strict` in this package's test suite.
- **No runtime dependency.** The generator has no templating or validation
  dependency; the output imports nothing.

## Notes

- Objects are structural in TypeScript, so `additionalProperties: false`
  removes the index signature but cannot make a type truly exact. Use a runtime
  validator if excess keys must be rejected.
- Optional properties use `?`, which is `T | undefined` without
  `exactOptionalPropertyTypes` and `T` with it.
- A required key that is not declared in `properties` is typed from the
  `patternProperties` schemas that match it, then from
  `additionalProperties`, or as `never` when the object is closed.
