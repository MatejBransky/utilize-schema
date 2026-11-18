# Dialects

JSON Schema is a family of dialects. The same keyword can mean different
things, or not exist at all, depending on the dialect a schema declares in
`$schema`. This project resolves the dialect for every schema resource and
checks every keyword against that dialect instead of guessing from keyword
shapes.

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

## Keyword policy

Generating code that applies a keyword the dialect does not define makes the
output stricter or looser than the standard, so the parser reports foreign
keywords and invalid keyword shapes. Reporting is a warning by default, and
compilation continues:

```ts
await compile({
	input: './schema.json',
	// draft-07 declares `prefixItems`, which 2020-12 replaced `items[]` with
	output: './schema.generated.ts',
});
// warning: "prefixItems" is not part of draft-07. (schema.json/prefixItems)
```

`DialectOptions` on `parse()` and `compile()` controls this:

```ts
await compile({
	input: './schema.json',
	output: './schema.generated.ts',
	keywordPolicy: 'warn', // default
});
```

- `keywordPolicy: 'warn'` (default) reports through `onDialectIssue`, and
  `parse()` also returns the issues as `issues`. The core library never writes
  to the console; the CLIs and the zod/effect `compile()` functions print the
  warnings when no `onDialectIssue` is given.
- `keywordPolicy: 'error'` fails validation instead, which is useful in CI to
  keep generated code faithful to the declared dialect.
- `keywordPolicy: 'ignore'` does not report foreign keywords.

The policy only decides how foreign keywords are reported; the parser does not
remove them, so a generator that supports such a keyword still applies it.
Valid keywords that no generator supports yet (`$dynamicRef`, `$recursiveRef`,
`minContains`, `maxContains`) always fail, whatever the policy.

The other options:

- `dialect`: `'auto'` (default) reads `$schema` per resource; any `DialectId`
  forces one dialect for the whole document.
- `fallbackDialect`: used when a schema omits `$schema`. Default `draft-07`.
- `unknownDialect`: `'fallback'` (default) uses `fallbackDialect` for an
  unrecognized `$schema`; `'error'` rejects it.

The CLIs expose the same options:

```sh
utilize-zod --keyword-policy error --dialect 2020-12 schema.json
utilize-effect --fallback-dialect draft-06 schema.yaml
```

`$ref` siblings are not an error in dialects that ignore them — the
specification only says they are ignored. They are reported as
`ignored-ref-siblings` with the default `keywordPolicy: 'warn'`.

## Metadata

Every linked node carries the resolved dialect:

```ts
import { dialectOf, Meta, parse } from '@utilize/json-schema';

const { root, issues } = await parse(schema, { cwd, fileName });
const meta = root[Meta];

meta.dialect; // '2020-12'
meta.dialectSource; // 'declared' | 'inherited' | 'fallback' | 'forced'

dialectOf(root); // the full Dialect definition
issues; // DialectIssue[] reported with keywordPolicy: 'warn'
```

A node the parser does not treat as a subschema (for example the `properties`
object itself) carries the dialect of its parent. A referenced file without
`$schema` inherits the dialect of the root document and is marked
`inherited`.
