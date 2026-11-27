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

The policy only decides how foreign keywords are reported. The parser keeps
them in the schema, and the generators skip them (see [Generation](#generation)).
Valid keywords that no generator supports yet (`$dynamicRef`, `$recursiveRef`)
always fail, whatever the policy.

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

## Schema validation

The parser checks keywords against the dialect, but it does not reject a schema
whose values have the wrong shape: `{"type": "nonsense"}` currently generates a
permissive `z.unknown()`. Validation is an opt-in step that checks every
resolved document against its dialect's meta-schema:

```sh
pnpm add -D ajv
utilize-zod --validate schema.json
```

```text
schema.json is not a valid draft-07 JSON Schema:
  /type must be equal to one of the allowed values
  /type must be array
```

`--validate` uses Ajv and dispatches to the draft the parser resolved:
draft-06, draft-07, 2019-09 or 2020-12. A document without `$schema` is
validated with the root's dialect, and `--dialect` / `--fallback-dialect` apply
exactly as they do to generation. Every resolved document is checked, including
`$ref` targets, and all findings are reported before anything is generated. A
directory or glob run writes no output when any file fails, because every input
is compiled before the first write.

Draft-04 is the one dialect Ajv 8 dropped, so validating a draft-04 document
needs the companion `ajv-draft-04` package (`pnpm add -D ajv-draft-04`). The
adapter imports it only when it actually validates a draft-04 document, so
schemas of the other four dialects need `ajv` alone.

Both are optional peer dependencies of `@utilize/json-schema`, so only the
built-in validator needs them.

### In code

Pass any validator with `validateSchema`; the callback gets the resolved
dialect, so an adapter can dispatch the same way:

```ts
import { compile } from '@utilize/zod';

await compile({
  input: './schema.json',
  validateSchema: (schema, { dialect }) => myValidator(schema, dialect),
});
```

Return every `SchemaValidationFinding` (`pointer`, `message`, optional
`keyword`). A non-empty result throws `SchemaValidationError` with one report
per document. The built-in adapter is exported too:

```ts
import { ajvValidator } from '@utilize/json-schema/validate/ajv';
```

A document that embeds resources of another dialect is checked as a whole
against the document's dialect; the parser still tracks each embedded resource
for generation.

### Another validator

`--validator <module>` implies `--validate` and replaces Ajv. The module can be
a path relative to `--cwd` or a package specifier, and must export the function
as its default export or as `validateSchema`:

```js
// validator.mjs
export default (schema, { dialect, filePath }) => [];
```

## Generation

Generators read the dialect from each node instead of guessing it from the
keywords:

- **`$ref` siblings** — draft-04/06/07 emit only the reference and ignore
  everything next to it. 2019-09/2020-12 intersect the reference with its
  sibling constraints.
- **Tuples** — `items[]` + `additionalItems` before 2020-12, `prefixItems` +
  `items` in 2020-12. The other shape is rejected by `keywordPolicy: 'error'`
  and ignored by `'warn'` / `'ignore'`.
- **Keyword applicability** — `const`, `contains`, `propertyNames`,
  `if`/`then`/`else`, `dependent*`, `minContains`, `maxContains`,
  `unevaluated*` and `$defs` only take effect in dialects that define them.
  With `'warn'` or `'ignore'` a foreign keyword is dropped, so the generated
  schema matches the standard instead of being stricter.

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
