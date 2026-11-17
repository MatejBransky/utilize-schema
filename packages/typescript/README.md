# @utilize/typescript

TypeScript type generator for JSON Schema. Converts a JSON Schema (with
references, `$defs` and `definitions`) into interfaces and type aliases — no
runtime dependency, no `any`, just the types.

It is the types-only sibling of [`@utilize/zod`](../zod) and
[`@utilize/effect`](../effect): the same parser, linker and naming rules, but it
emits a plain `.ts` module instead of a validation library. It is a drop-in
alternative to
[`json-schema-to-typescript`](https://github.com/bcherny/json-schema-to-typescript)
for the cases where you want types without a schema runtime.

## Features

- Emits an interface for every object and a type alias for everything else
- One exported declaration per standalone schema (root, `$defs`, `definitions`,
  referenced)
- Handles local, external and cyclic `$ref`s — recursive types come out as
  interfaces and deferred aliases that TypeScript accepts
- Rejects cycles TypeScript cannot express with a clear error instead of
  emitting code that does not compile
- `allOf` becomes an intersection, `anyOf` and `oneOf` become unions
- `patternProperties` and `additionalProperties` become index signatures
- JSDoc from `title`, `description`, `deprecated`, `default`, `format` and
  `examples`
- `readOnly` becomes a `readonly` modifier
- Permissive schemas map to `unknown`, not `any`

## Usage

```ts
import { compile } from '@utilize/typescript';

await compile({
	input: './schema.json',
	output: './schema.generated.ts',
});
```

Or generate from an already parsed schema:

```ts
import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/typescript';

const { root } = await parse(schema, { cwd: process.cwd(), fileName: 'schema.json' });
const code = generate(root);
```

## Output

Objects become interfaces, with an index signature unless the schema is closed:

```ts
export interface Person {
	name: string;
	age?: number;
	[key: string]: unknown;
}
```

Enums and `const` become literal unions:

```ts
export type Status = 'open' | 'closed';
```

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

| JSON Schema keyword                           | TypeScript                                         |
| --------------------------------------------- | -------------------------------------------------- |
| `type`                                        | Primitive types, unions of types                   |
| `const`, `enum`                               | Literal types (objects and arrays too)             |
| `properties`, `required`                      | Interface members, optional members                |
| `additionalProperties`                        | Index signature (`unknown` when open)              |
| `patternProperties`                           | Index signature union with the pattern schemas     |
| `items`, `prefixItems`, `additionalItems`     | `Array<T>`, tuples with optional and rest elements |
| `allOf`                                       | Intersection                                       |
| `anyOf`, `oneOf`                              | Union                                              |
| `$ref`, `$defs`, `definitions`                | Named declarations, including cycles               |
| `title`, `description`                        | JSDoc                                              |
| `deprecated`, `default`, `format`, `examples` | JSDoc tags                                         |
| `readOnly`                                    | `readonly` modifier                                |

Validation-only keywords (`minLength`, `pattern`, `minimum`, `uniqueItems`,
`minItems`, `not`, `if`/`then`/`else`, `dependencies`, …) have no equivalent in
a TypeScript type and are ignored. They are not silently dropped from a schema:
use [`@utilize/zod`](../zod) or [`@utilize/effect`](../effect) when you need
runtime validation.

`$ref` siblings are resolved by the parser before generation, so a reference
with sibling keywords becomes one merged schema.

## Conformance

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

- **166 of 288 cases** pass in both directions.
- **787 of 813** spec-valid instances are accepted.
- **207 of 788** spec-invalid instances are rejected.
- **100 cases** differ only because an invalid instance is accepted. TypeScript
  cannot express `minimum`, `pattern`, `format`, `uniqueItems`, `dependencies`,
  `if`/`then`/`else`, and similar value constraints, so these are inherent to
  the target.
- **22 cases** are listed in `test/suite/knownGaps.ts`: 10 need `$id`/`$anchor`
  or boolean-schema `$ref` resolution from the shared parser, and 12 are the
  inference trade-off described below.

The numbers are recorded in `test/suite/baseline.ts` and the test fails when
they change, so a regression cannot slip in and an improvement has to update the
baseline on purpose.

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

### Compared with json-schema-to-typescript

At its own pinned revision (`5caacfc`, suite `3c25e5f`) json-schema-to-typescript
records 141 of 257 draft-07 groups with no valid instance rejected and no invalid
one accepted, 24 crashes and 2 invalid TypeScript files. Its instance totals are
490 of 516 valid accepted and 198 of 342 invalid rejected. The suite revisions
and case selections differ (257 groups there, 288 runnable cases here; this
runner skips cases that need external schemas), so the numbers describe two
different records rather than a score. On the same group metric the TypeScript
generator is ahead (57.6% vs 54.9%), accepts more valid instances (96.8% vs
95.0%), emits no invalid TypeScript and crashes only where the shared parser has
the same `$id`/`$anchor` gap (10 cases vs 24). Instance-level invalid rejection
is not comparable across the two revisions: this runner rejects 26.3% of 788
invalid instances, json-schema-to-typescript 57.9% of its 342, largely because
the newer suite revision adds many more `format` cases that a type cannot
reject.

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
- A required key that is not declared in `properties` is typed from
  `additionalProperties`, or as `never` when the object is closed.

## When to use

Use this package when you want TypeScript types from JSON Schema without adding
a schema runtime — for API clients, configuration files, generated domain
models or migration from `json-schema-to-typescript`.
