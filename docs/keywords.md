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

<details>
<summary>How the three numbers add up</summary>

All three generators start from the same draft-07 subset. [The loader](../packages/test-utils/src/suite/loadSuite.ts)
reads the top-level `validation/tests` files of the pinned suite and keeps a
case when its `compatibility` allows draft-07, which leaves 304 of 613 cases
(`optional/` and `proposals/` are not loaded).

| Step                        | Zod | Effect Schema | TypeScript |
| --------------------------- | --- | ------------- | ---------- |
| draft-07 cases in the suite | 304 | 304           | 304        |
| − `format-assertion` cases  | —   | —             | 19         |
| **= cases run**             | 304 | 304           | 285        |
| − known gaps                | 0   | 0             | 12         |
| − type-level gaps           | —   | —             | 81         |
| **= cases passing**         | 304 | 304           | 192        |

The runtime generators measure both format groups: `format-annotation` cases
compile with `formatMode: 'annotate'` and `format-assertion` cases with
`formatMode: 'assert'`, so all 304 draft-07 cases run. A type cannot check a
format either way, so the TypeScript generator skips the 19 `format-assertion`
cases instead. The 16 cases that need `externalSchemas` run against the
documents the suite provides. The skip rule for each target is in its suite
runner
([Zod](../packages/zod/test/jsonSchemaTestSuite.test.ts),
[Effect Schema](../packages/effect/test/jsonSchemaTestSuite.test.ts),
[TypeScript](../packages/typescript/test/jsonSchemaTestSuite.test.ts)).

The 81 type gaps are cases where an invalid instance is rejected only by a
keyword a type cannot express (`minimum`, `pattern`, `format`, …);
[`baseline.ts`](../packages/typescript/test/suite/baseline.ts) records that count
next to the 191 conformant cases. Every other gap is an explicit entry with a
reason, so fixing one or introducing a regression changes the count and fails
the suite instead of drifting silently.

Assertions add up the same way, because one instance is one assertion:

| Step                        | Zod   | Effect Schema |
| --------------------------- | ----- | ------------- |
| instances in draft-07 cases | 1,655 | 1,655         |
| − failing                   | 256   | 255           |
| **= passing**               | 1,399 | 1,400         |

The type-level runner prints both the pass count and the accepted/rejected
split; the current numbers are in [docs/conformance.md](./conformance.md).

</details>

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

| JSON Schema keyword                           | TypeScript                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `type`                                        | Primitive types, unions of types                                  |
| `const`, `enum`                               | Literal types (objects and arrays too), intersected with siblings |
| `properties`, `required`                      | Interface members, optional members                               |
| `additionalProperties`                        | Index signature (`unknown` when open)                             |
| `patternProperties`                           | Index signature union with the pattern schemas                    |
| `items`, `prefixItems`, `additionalItems`     | `Array<T>`, tuples with optional and rest elements                |
| `allOf`                                       | Intersection                                                      |
| `anyOf`, `oneOf`                              | Union, intersected with the sibling keywords                      |
| `$ref`, `$defs`, `definitions`                | Named declarations, including cycles                              |
| `title`, `description`                        | JSDoc, skipping a title that only repeats the name                |
| `deprecated`, `default`, `format`, `examples` | JSDoc tags                                                        |
| `readOnly`                                    | `readonly` modifier                                               |

Validation-only keywords (`minLength`, `pattern`, `minimum`, `uniqueItems`,
`minItems`, `not`, `if`/`then`/`else`, `dependencies`, …) have no equivalent in
a TypeScript type and are ignored. They are not silently dropped from a schema:
use [`@utilize/zod`](../packages/zod) or [`@utilize/effect`](../packages/effect)
when you need runtime validation.

`$ref` siblings are resolved by the parser before generation, so a reference
with sibling keywords becomes one merged schema.
