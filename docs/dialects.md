# Dialects

JSON Schema is a family of dialects. The same keyword can mean different
things, or not exist at all, depending on the dialect a schema declares in
`$schema`. This project resolves the dialect for every schema resource and
generates code from that dialect instead of guessing from keyword shapes.

## Supported dialects

`draft-04`, `draft-06`, `draft-07`, `2019-09` and `2020-12`.

The dialect is read per **resource**: the document root and every subschema
that declares a non-fragment `$id` (`id` in draft-04) or its own `$schema`. An
embedded resource without `$schema` inherits the dialect of its parent. A
schema without `$schema` falls back to `draft-07` unless `fallbackDialect` says
otherwise.

## Keywords by dialect

| Behavior                                     | draft-04                      | draft-06       | draft-07       | 2019-09      | 2020-12                 |
| -------------------------------------------- | ----------------------------- | -------------- | -------------- | ------------ | ----------------------- |
| `$ref` siblings                              | ignored                       | ignored        | ignored        | applied      | applied                 |
| Definitions container                        | `definitions`                 | `definitions`  | `definitions`  | `$defs`      | `$defs`                 |
| Tuple form                                   | `items[]` + `additionalItems` | same           | same           | same         | `prefixItems` + `items` |
| Exclusive bounds                             | boolean                       | number         | number         | number       | number                  |
| Dependencies                                 | `dependencies`                | `dependencies` | `dependencies` | `dependent*` | `dependent*`            |
| `const`                                      | not defined                   | defined        | defined        | defined      | defined                 |
| `contains`                                   | not defined                   | defined        | defined        | defined      | defined                 |
| `minContains` / `maxContains`                | not defined                   | not defined    | not defined    | defined      | defined                 |
| `propertyNames`                              | not defined                   | defined        | defined        | defined      | defined                 |
| `if` / `then` / `else`                       | not defined                   | not defined    | defined        | defined      | defined                 |
| `unevaluatedProperties` / `unevaluatedItems` | not defined                   | not defined    | not defined    | defined      | defined                 |
| Boolean schemas                              | not allowed                   | allowed        | allowed        | allowed      | allowed                 |
| `format` default                             | annotation                    | annotation     | annotation     | annotation   | annotation              |

`definitions` and `$defs` are accepted as aliases of each other, and `id` /
`$id` only affect naming, so they never fail strict validation. Every other
keyword above is treated as belonging to the dialects marked "defined".

## Strict by default

Generating code that applies a keyword the dialect does not define makes the
output stricter than the standard. The parser therefore rejects foreign
keywords and invalid keyword shapes by default:

```ts
await compile({
	input: './schema.json',
	// draft-07 declares `prefixItems`, which 2020-12 replaced `items[]` with
	output: './schema.generated.ts',
});
// DialectError: "prefixItems" is not part of draft-07. (schema.json/prefixItems)
```

`DialectOptions` on `parse()` and `compile()` controls this:

```ts
await compile({
	input: './schema.json',
	output: './schema.generated.ts',
	keywordPolicy: 'error', // default
});
```

- `keywordPolicy: 'error'` (default) fails validation.
- `keywordPolicy: 'warn'` reports through `onDialectIssue` (or `console.warn`)
  and then ignores the keyword.
- `keywordPolicy: 'ignore'` ignores foreign keywords silently, which is what the
  specification requires for keywords a dialect does not define.

The other options:

- `dialect`: `'auto'` (default) reads `$schema` per resource; any `DialectId`
  forces one dialect for the whole document.
- `fallbackDialect`: used when a schema omits `$schema`. Default `draft-07`.
- `unknownDialect`: `'error'` (default) rejects an unrecognized `$schema`;
  `'fallback'` uses `fallbackDialect` instead.

The CLIs expose the same options:

```sh
utilize-zod --keyword-policy warn --dialect 2020-12 schema.json
utilize-effect --fallback-dialect draft-06 schema.yaml
```

`$ref` siblings are not an error in dialects that ignore them — the
specification only says they are ignored. With `keywordPolicy: 'warn'` they are
reported as `ignored-ref-siblings`.

## Metadata

Every linked node carries the resolved dialect:

```ts
import { dialectOf, Meta, parse } from '@utilize/json-schema';

const { root } = await parse(schema, { cwd, fileName });
const meta = root[Meta];

meta.dialect; // '2020-12'
meta.dialectSource; // 'declared' | 'inherited' | 'fallback' | 'forced'

dialectOf(root); // the full Dialect definition
```
