# Keyword coverage

What each generator does with the JSON Schema keywords, and the dialect rules
behind it. The runtime generators are also checked against each other by the
differential parity suite
([`packages/effect/test/parity.test.ts`](../packages/effect/test/parity.test.ts)).
The dialect rules themselves are in [dialects.md](./dialects.md). Every number comes from the official
[JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
and is pinned in the package's baseline, so it cannot drift silently.

## Conformance numbers

All three generators are checked for draft-04, draft-06, draft-07, 2019-09 and
2020-12. The numbers below are draft-07:

- **Zod:** 304 of 304 cases (1,655 of 1,655 assertions) pass.
- **Effect Schema:** 304 of 304 cases (1,655 of 1,655 assertions) pass.
- **TypeScript:** 192 of 285 cases pass at the type level (795 of 972 instances),
  with 81 type gaps.
  [Baseline](../packages/typescript/test/suite/baseline.ts) ·
  [Known gaps](../packages/typescript/test/suite/knownGaps.ts)

[docs/conformance.md](./conformance.md) compares these numbers with
json-schema-to-typescript.

The runtime generators run every draft-07 case, including both format groups and
the cases that need external schemas. A type cannot validate a value, so the
TypeScript runner skips the 19 `format-assertion` cases and records its remaining
gaps explicitly. Every count is asserted in the package baseline, so a
regression fails the suite instead of drifting silently.

## Runtime generators

| JSON Schema Keyword                          | Zod | Effect Schema | Notes                                                                                 |
| -------------------------------------------- | --- | ------------- | ------------------------------------------------------------------------------------- |
| `type`                                       | ✅  | ✅            | Full support, including unions of types                                               |
| `enum`                                       | ✅  | ✅            | Both compare structured values deeply; JSON types stay distinct                       |
| `const`                                      | ✅  | ✅            | Both compare structured values deeply; JSON types stay distinct                       |
| `default`                                    | ✅  | ✅            | Zod decodes with `.default()`; Effect stores it as an annotation                      |
| `description` / `title` / `deprecated`       | ✅  | ✅            | Zod `.meta({})`, Effect `.annotate({})`                                               |
| `readOnly`                                   | ✅  | —             | Zod `.readonly()` with `readOnlyKeyword`; Effect keeps it as an annotation            |
| `minimum` / `maximum`                        | ✅  | ✅            | Supported                                                                             |
| `exclusiveMinimum` / `exclusiveMaximum`      | ✅  | ✅            | Supported (boolean draft-04 form included)                                            |
| `multipleOf`                                 | ✅  | ✅            | Supported                                                                             |
| `minLength` / `maxLength`                    | ✅  | ✅            | Effect counts code points, like JSON Schema                                           |
| `pattern`                                    | ✅  | ✅            | Zod `.regex()`, Effect `Schema.isPattern`                                             |
| `format`                                     | ✅  | ✅            | Asserted by default; `formatMode: 'annotate'` keeps it as metadata                    |
| `properties`                                 | ✅  | ✅            | Supported                                                                             |
| `required`                                   | ✅  | ✅            | Supported                                                                             |
| `additionalProperties`                       | ✅  | ✅            | Zod `z.strictObject`/`.catchall`, Effect keeps excess keys and filters them           |
| `minProperties` / `maxProperties`            | ✅  | ✅            | Counted on the input, so undeclared keys count too                                    |
| `patternProperties`                          | ✅  | ✅            | Every matching pattern is validated, then `additionalProperties` applies              |
| `propertyNames`                              | ✅  | ✅            | Supported                                                                             |
| `items`                                      | ✅  | ✅            | Supported                                                                             |
| `prefixItems`                                | ✅  | ✅            | 2020-12 syntax, also via the tuple form of `items`                                    |
| `additionalItems`                            | ✅  | ✅            | Supported                                                                             |
| `uniqueItems`                                | ✅  | ✅            | Key-order-insensitive comparison                                                      |
| `contains`                                   | ✅  | ✅            | Supported                                                                             |
| `minContains` / `maxContains`                | ✅  | ✅            | Counted with `contains` in 2019-09 and newer                                          |
| `dependencies`                               | ✅  | ✅            | Also covers `dependentRequired` and `dependentSchemas`                                |
| `allOf`                                      | ✅  | ✅            | Zod intersects any schemas; Effect merges object/scalar/array parts, filters the rest |
| `anyOf`                                      | ✅  | ✅            | Supported                                                                             |
| `oneOf`                                      | ✅  | ✅            | Zod requires exactly one match; Effect uses the exclusive union mode                  |
| `not`                                        | ✅  | ✅            | Supported                                                                             |
| `if` / `then` / `else`                       | ✅  | ✅            | Supported                                                                             |
| `discriminator`                              | ✅  | —             | Zod emits a discriminated union; Effect ignores the annotation                        |
| `$ref`                                       | ✅  | ✅            | Local, external, cyclic and `$id`/`$anchor` based; boolean targets supported          |
| `$defs` / `definitions`                      | ✅  | ✅            | Supported                                                                             |
| `$id` / `$anchor`                            | ✅  | ✅            | Establishes the base URI and resolves fragment identifiers                            |
| `examples`                                   | ✅  | ✅            | Kept as metadata                                                                      |
| `$schema`                                    | ✅  | ✅            | Detects draft-04/06/07/2019-09/2020-12 and normalizes newer keywords                  |
| `unevaluatedProperties` / `unevaluatedItems` | ✅  | ✅            | Mapped to `additionalProperties` / the items rest (best effort)                       |

`✅` supported, `❌` rejected with a clear error, `—` accepted but only kept as
an annotation.

A schema without `type` gets one branch per constrained type (object, array,
string or number), so constraints such as `{ pattern }` or `{ required }` are
not silently dropped, and `{ minLength: 2, minimum: 5 }` checks both strings and
numbers while still accepting every other JSON type.

2020-12 `prefixItems` maps to the tuple form of `items`, and
`dependentRequired`/`dependentSchemas` map to `dependencies`. `unevaluatedProperties`
and `unevaluatedItems` map to `additionalProperties` / the items rest when those
are not set, which covers schemas that do not rely on properties evaluated by
applicators. The runtime generators intersect `$ref` siblings in 2019-09 and
2020-12, and ignore them in draft-07 and older, as those dialects define.
Unknown `$schema` values fall back to draft-07. 2019-09/2020-12 keywords without
a generator (`$recursiveRef`, `$dynamicRef`) fail with
`UnsupportedSchemaFeatureError`.

## Effect Schema specifics

Effect has no schema constructor for negation, conditionals or "contains", so
`not`, `if`/`then`/`else`, `contains` and `dependencies` are emitted as
`Schema.makeFilter` checks that evaluate the subschemas with `Schema.is`.
`dependentRequired` and `dependentSchemas` are normalized to `dependencies`
before generation.

`unevaluatedProperties` and `unevaluatedItems` are normalized to
`additionalProperties` and the items rest before generation, as a best effort
for schemas that do not rely on properties evaluated by applicators.

The generator throws `UnsupportedEffectSchemaFeatureError` only for a schema it
cannot express: a `pattern` that is not valid in Unicode mode, and an `allOf`
whose members can be neither merged nor checked as filters.

`$ref` siblings follow the dialect: draft-07 and older ignore them, 2019-09 and
newer merge disjoint object siblings into one struct. Other siblings (a
non-object or recursive target, `not`, `if`, ...) are checked with a filter on
the reference, which keeps the reference's type.

Effect has no generic intersection, so `allOf` is limited to merging object
subschemas that do not declare the same property.

## TypeScript

| JSON Schema keyword                       | TypeScript                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `type`                                    | Primitive types, unions of types                                                           |
| `const`, `enum`                           | Literal types (objects and arrays too), intersected with siblings                          |
| `properties`, `required`                  | Interface members, optional members                                                        |
| `additionalProperties`                    | Index signature (`unknown` when open)                                                      |
| `patternProperties`                       | Index signature union with the pattern schemas                                             |
| `items`, `prefixItems`, `additionalItems` | `Array<T>`, tuples with optional and rest elements                                         |
| `allOf`                                   | Intersection                                                                               |
| `anyOf`, `oneOf`                          | Union, intersected with the sibling keywords                                               |
| `$ref`, `$defs`, `definitions`            | Named declarations, including cycles                                                       |
| `title`, `description`                    | JSDoc, skipping a title that only repeats the name                                         |
| `format`                                  | JSDoc; `unknown` unless a type or shape applies, or `string` with `inference: 'pragmatic'` |
| `deprecated`, `default`, `examples`       | JSDoc tags                                                                                 |
| `readOnly`                                | `readonly` modifier                                                                        |

`format` only applies to strings. A schema that would otherwise be `unknown`
stays `unknown` by default; `inference: 'pragmatic'` opts into treating the
keyword family as the intended type (`format` → `string`, `minimum` → `number`,
`contains` → `array`).

Validation-only keywords (`minLength`, `pattern`, `minimum`, `uniqueItems`,
`minItems`, `not`, `if`/`then`/`else`, `dependencies`, …) have no equivalent in
a TypeScript type and are ignored. They are not silently dropped from a schema:
use [`@utilize/zod`](../packages/zod) or [`@utilize/effect`](../packages/effect)
when you need runtime validation.

`$ref` siblings are resolved by the parser before generation, so a reference
with sibling keywords becomes one merged schema.
