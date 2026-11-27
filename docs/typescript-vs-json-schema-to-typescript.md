# @utilize/typescript and json-schema-to-typescript

This page explains the difference behind the TypeScript conformance table. It is
not an argument that `@utilize/typescript` is generally better. The two
generators make different trade-offs, and most of the score difference comes from
one of them narrowing more aggressively when JSON Schema does not justify it.

In the same type-level run, `@utilize/typescript` passes more cases. It also
**accepts more invalid instances**: its type gaps are 427 cases, against 224 for
json-schema-to-typescript. The advantage is fewer valid instances rejected and
fewer resolver/boolean-schema crashes, not a larger set of constraints that
TypeScript can express.

## How the comparison is measured

Both generators run the official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
at the same pinned revision (`e2a68a1`), on the same five dialects, with the same
case selection (`format-assertion` cases are skipped). Each suite instance is
emitted as a typed constant next to the generated declarations, and one
`tsc --strict` run decides acceptance.

A case passes only when **every spec-valid instance is accepted and every
spec-invalid instance is rejected**. This matters:

- A type that is too narrow **rejects valid instances** — a structural gap.
- A type that is too wide **accepts invalid instances** — a type gap.

Both are failures in this metric. A generator cannot win by returning `unknown`
everywhere, because all the invalid instances would then be accepted.

json-schema-to-typescript is pinned to `16.0.0`. Its own conformance baseline is
recorded on an older suite revision (`3c25e5f`) and includes 1,000 mutation
cases, so compare the two columns on this page with each other, not the absolute
number with its published result.

## The main difference: inferring a type from a keyword

JSON Schema keywords apply only to instances of a particular type. A schema
without `type` is not a promise that the value has that type; it is a set of
constraints that are ignored for values of other types.

`@utilize/typescript` follows that rule for scalar and conditional keywords: it
does not infer `string` from `format`, `number` from `minimum`, or `object` from
`if`. json-schema-to-typescript often does infer a concrete shape, which is more
useful in everyday schemas but makes the generated type reject spec-valid
instances.

| Schema                              | What the specification says                                      | `@utilize/typescript` | json-schema-to-typescript |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------- | ------------------------- |
| `{ "format": "email" }`             | `format` applies to strings; other instance types are unaffected | `unknown`             | object index signature    |
| `{ "minimum": 3 }`                  | the keyword constrains numeric instances only                    | `unknown`             | object index signature    |
| `{ "contains": { … } }`             | the keyword constrains array instances only                      | `unknown`             | object index signature    |
| `{ "if": …, "then": …, "else": … }` | branches depend on the instance value                            | `unknown`             | object index signature    |
| `{ "not": { … } }`                  | the complement of the subschema                                  | `unknown`             | object index signature    |
| `{ "properties": … }`               | an object shape                                                  | object                | object                    |
| `{ "items": … }`                    | an array shape                                                   | array                 | array                     |

### `format` without `type`

```json
{ "format": "email" }
```

The format annotation vocabulary says that formats apply to strings, and that a
format attribute can be defined for other types as well: see
[JSON Schema Validation, Format-Annotation Vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation#name-format-annotation-vocabular).
A number, object, array, boolean or `null` is therefore valid against this
schema.

```ts
// @utilize/typescript
export type Root = unknown;
```

```ts
// json-schema-to-typescript 16.0.0
export interface Root {
  [k: string]: unknown;
}
```

The second type rejects numbers and arrays, which the specification accepts.
Adding `type` makes the intent explicit, and both generators then emit `string`:

```json
{ "type": "string", "format": "email" }
```

### `minimum`, `maximum`, `multipleOf`

```json
{ "minimum": 3 }
```

The specification says the keyword validates only if the instance is a number:
see [JSON Schema Validation, minimum](https://json-schema.org/draft/2020-12/json-schema-validation#name-minimum).
`"foo"` and `{}` are valid against this schema. `@utilize/typescript` keeps it
`unknown`; json-schema-to-typescript emits an object index signature, rejecting
those valid instances. The same applies to `maximum`, `exclusiveMinimum`,
`exclusiveMaximum`, `multipleOf`, `pattern` and `minLength`.

### `contains`, `if`/`then`/`else`, `not`

These are applicators, not type declarations. A `contains` schema constrains
array instances only: see [JSON Schema Core, contains](https://json-schema.org/draft/2020-12/json-schema-core#name-contains).
An `if` schema has no direct effect on validation; it selects `then` or `else`:
see [JSON Schema Core, if](https://json-schema.org/draft/2020-12/json-schema-core#name-if).
`not` is the complement of its subschema: see
[JSON Schema Core, not](https://json-schema.org/draft/2020-12/json-schema-core#name-not).

None of these can be represented exactly in TypeScript, because they depend on
the value, not only on its type. `@utilize/typescript` keeps the type `unknown`
instead of guessing a shape. json-schema-to-typescript guesses an object type,
which rejects valid strings, numbers and arrays.

### Structural keywords where both agree

`allOf` becomes an intersection, `anyOf` and `oneOf` become unions, `properties`
and `required` become members, `items` becomes an array, and `const`/`enum`
become literal types. Those are the cases where TypeScript genuinely can express
the structure:

- [allOf](https://json-schema.org/draft/2020-12/json-schema-core#name-allof),
  [anyOf](https://json-schema.org/draft/2020-12/json-schema-core#name-anyof),
  [oneOf](https://json-schema.org/draft/2020-12/json-schema-core#name-oneof)
- [properties](https://json-schema.org/draft/2020-12/json-schema-core#name-properties)
  and [required](https://json-schema.org/draft/2020-12/json-schema-validation#name-required)
- [items](https://json-schema.org/draft/2020-12/json-schema-core#name-items)
  and [prefixItems](https://json-schema.org/draft/2020-12/json-schema-core#name-prefixitems)

`oneOf` is only an approximation: TypeScript cannot say that a value must match
exactly one member of a union, so the generated type is a plain union.
`prefixItems` is a real difference in our favour: we emit a tuple, while
json-schema-to-typescript emits `unknown[]` for the pinned version. That is a
structural feature, not a difference in how carefully either generator treats
non-matching instance types.

## Differences that are not about type inference

Some cases in the table are not about a smarter TypeScript type at all:

- **`$id`, `$anchor` and relative `$ref`.** `$id` establishes the base URI and a
  relative `$ref` is resolved against it: see
  [The `$id` keyword](https://json-schema.org/draft/2020-12/json-schema-core#name-the-id-keyword)
  and [Direct References with `$ref`](https://json-schema.org/draft/2020-12/json-schema-core#name-direct-references-with-ref).
  The pinned json-schema-to-typescript release fails to resolve several of these
  suite cases; `@utilize/typescript` resolves them. This is a resolver
  difference, not a richer generated type.
- **Boolean schemas.** `true` and `false` are valid JSON Schemas that always
  accept or reject: see
  [Boolean JSON Schemas](https://json-schema.org/draft/2020-12/json-schema-core#name-boolean-json-schemas).
  `@utilize/typescript` maps them to `unknown` and `never`;
  json-schema-to-typescript's `compile()` expects an object schema and throws.
- **`unevaluatedItems` and `unevaluatedProperties`.** These depend on
  annotations collected across applicators, which a TypeScript type does not
  carry: see
  [unevaluatedItems](https://json-schema.org/draft/2020-12/json-schema-core#name-unevaluateditems)
  and
  [unevaluatedProperties](https://json-schema.org/draft/2020-12/json-schema-core#name-unevaluatedproperties).
  Cases where one generator passes are usually caused by the other crashing or
  over-narrowing, not by a type that expresses the annotation.

## Where json-schema-to-typescript is more precise

The comparison is not one-sided. The pinned release does more in several places:

- **Bounded arrays.** `minItems` and `maxItems` become tuple unions such as
  `[string] | [string, string]`; the Utilize generator emits `Array<string>`.
  This is why it passes
  `ref.json :: ref applies alongside sibling keywords` for 2019-09 and 2020-12.
- **`not` narrowing.** It narrows some `not` schemas more tightly. For example,
  a forbidden property becomes an object type rather than `unknown`, which
  rejects the suite's numeric value. It is still not a general complement type.
- **Named and `const` enums** through `tsEnumNames`, `enableConstEnums` and
  `inferStringEnumKeysFromValues`; the Utilize generator always emits a literal
  union.
- **`tsType`**, a schema extension for a custom TypeScript type. The Utilize API
  has `customSchemaResolver` for the same use case.
- **Draft-03 `required: true`** on a property, which predates the draft-04
  `required` array.

## What accounts for the gap

The current run has 431 cases where `@utilize/typescript` passes and
json-schema-to-typescript does not, and 14 in the other direction. An approximate
classification of the 431:

| Source                                                                                                | Cases |
| ----------------------------------------------------------------------------------------------------- | ----: |
| A keyword applied to one type is narrowed to that type (`format`, `minimum`, `contains`, `if`, `not`) |   145 |
| `$id` / `$anchor` / relative `$ref` resolution                                                        |   115 |
| Shape inference on `if`, `contains`, `not`, `items`, `allOf`, `anyOf`                                 |    78 |
| `unevaluated*` cases                                                                                  |    41 |
| Boolean schemas                                                                                       |     8 |
| Other                                                                                                 |    44 |

The counts are a guide, not a second baseline. The important part is that only a
minority are cases where we express a constraint the competitor cannot. Most are
cases where the competitor produces a narrower type than the specification
justifies.

## What the numbers mean

On the pinned suite:

| Metric                                                       | `@utilize/typescript` | json-schema-to-typescript |
| ------------------------------------------------------------ | --------------------: | ------------------------: |
| Cases passing both directions                                |     963 / 1,530 (62%) |         546 / 1,530 (35%) |
| Instances classified correctly                               |   4,033 / 5,133 (78%) |       2,808 / 5,133 (54%) |
| Type gaps (invalid instance accepted)                        |                   427 |                       224 |
| Structural gaps (crash, invalid TS, valid instance rejected) |                   140 |                       760 |

The structural gap is where the score comes from: 140 cases versus 760. The type
gap runs the other way: 427 versus 224. In other words, this generator is
**more conservative, not more expressive**. It rejects fewer valid instances and
accepts more invalid ones. If rejecting invalid values matters, use
[`@utilize/zod`](../packages/zod) or [`@utilize/effect`](../packages/effect);
TypeScript types cannot express `minimum`, `pattern`, `format`, `uniqueItems`,
`if`/`then`/`else` or the other value predicates.

## Reproducing

```sh
pnpm --filter @utilize/typescript test:suite
pnpm --filter @utilize/test-utils test:suite
```

The recorded numbers are in
[`packages/typescript/test/suite/baseline.ts`](../packages/typescript/test/suite/baseline.ts)
and
[`packages/test-utils/src/suite/jsonSchemaToTypescriptBaseline.ts`](../packages/test-utils/src/suite/jsonSchemaToTypescriptBaseline.ts).
