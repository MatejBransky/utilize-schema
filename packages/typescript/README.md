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
