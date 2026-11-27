# @utilize/json-schema

[![npm version](https://img.shields.io/npm/v/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)
[![Unit test coverage](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/coverage-json-schema.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/CONTRIBUTING.md#coverage-badge)

The shared foundation behind `@utilize/zod`, `@utilize/effect` and
`@utilize/typescript`. It resolves `$ref`s, annotates every node with the metadata
a generator needs, and exports the target-neutral format validators both runtime
generators import. It never emits a target schema.

- **Every reference shape.** Local, external, `$id`/`$anchor`, boolean targets
  and recursive graphs.
- **Linked, not expanded.** Cyclic schemas stay a graph, so traversal never
  blows up.
- **Metadata per node.** Parent, referenced schema, file name and dialect, under
  a `Meta` symbol that never serializes.
- **Shared generator plumbing.** `collectStandaloneSchemas`, the format
  metadata and the `@utilize/json-schema/node` entry — CLI runner, flags,
  JSON/YAML and file/glob input, `compilePaths` — are what the three generator
  packages build on.
- **Runtime validators.** `@utilize/json-schema/formats` exports the structural
  format checks (`formatEmail`, `formatUri`, `formatDateTime`, …) that generated
  Zod and Effect schemas import instead of inlining them.
- **Opt-in validation.** Pass any `SchemaValidator` to `parse` or `compile`, or
  use the included Ajv adapter to check every resolved document against its
  dialect's meta-schema.
- **90% line coverage.**

```sh
pnpm add @utilize/json-schema
```

Generated schemas import `@utilize/json-schema/formats` at runtime, so that
package is a runtime dependency of the code they produce. Use `pnpm add -D`
only when the project calls the parser or CLI at build time and does not run
generated schemas. Bundlers can tree-shake unused validators; target-native
helpers such as `z.url()` remain native.

```ts
import { Meta, parse } from '@utilize/json-schema';

const { root } = await parse(schema, { cwd: '/', fileName: 'schema.json' });
root[Meta]; // parent, reference, fileName, dialect, …
```

<details>
<summary>Table of contents</summary>

- [Metadata](#metadata)
- [Usage](#usage)
- [External schemas by URI](#external-schemas-by-uri)
- [Dialects](#dialects)
- [Schema validation](#schema-validation)
- [Benchmarks](#benchmarks)

</details>

## Metadata

Each schema node is annotated with a non-enumerable `Meta` symbol:

```ts
import { parse, Meta } from '@utilize/json-schema';

const { root } = await parse(schema, { cwd, fileName });
const meta = root[Meta];
console.log(meta);
// {
//   parent,        // Reference to the parent schema node
//   reference,     // Referenced schema (when the node is a $ref); a boolean for boolean schemas
//   isCircular,    // $ref target is already on this file's stack
//   fileName,      // Name of the JSON file
//   filePath,      // Path to the schema file
//   path,          // Path within the schema
//   resolvedName,  // Placeholder for code generators (set later)
//   dialect,       // Dialect of the schema resource ('draft-07', '2020-12', ...)
//   dialectSource, // 'declared' | 'inherited' | 'fallback' | 'forced'
// }
```

`isCircular` is a per-file hint: it marks a `$ref` whose target is already on
the current file's stack. A cycle that spans files, or one that goes through
references between definitions, has to be derived from the `reference` links by
the generator. Generators derive those cycles from the `reference` links, each in its own way:
`@utilize/zod` sorts a dependency graph and breaks cycles with getters or
`z.lazy()`, while `@utilize/effect` emits every reference through
`Schema.suspend`.

`parse` also returns `get($ref)` for looking up a resolved schema and
`referencedSchemas` for the external files that were loaded.

When the document root is a `$ref`, `root` stays the document node and
`root[Meta].reference` points at the target, and `referencedSchemas` does not
include the root document. `get('#')` is unchanged: for a local pointer root
(`{ "$ref": "#/definitions/name" }`) it returns the referenced schema, while a
`$ref` to another file resolves to that document.

## Usage

```ts
import { parse, Meta } from '@utilize/json-schema';

const { root } = await parse(schema, {
  cwd: process.cwd(),
  fileName: 'schema.json',
});
console.log(root[Meta]);
```

## External schemas by URI

External documents are normally read from disk or fetched over HTTP. Pass
`externalSchemas` to serve them from memory instead, keyed by retrieval URI:

```ts
import { parse } from '@utilize/json-schema';

const { root } = await parse(schema, {
  cwd: process.cwd(),
  fileName: 'schema.json',
  externalSchemas: {
    'https://example.com/address.json': {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
  },
});
```

A URI in the map is never read from disk or the network. Identifiers declared
inside a provided document (`$id`, or the draft-04 `id`) are served too, so a
`$ref` can point at a nested identifier before the containing document is
loaded.

## Dialects

The dialect is resolved per schema resource from `$schema` and copied into
`Meta`. Keywords that do not belong to the node's dialect are reported as
warnings by default, so draft-2020-12 syntax in a draft-07 schema does not go
unnoticed. `keywordPolicy: 'error'` fails instead, and `'ignore'` does not
report them. The library never writes to the console: issues go to
`onDialectIssue` and are also returned by `parse()`.

```ts
import { formatIssue, parse } from '@utilize/json-schema';

await parse(schema, {
  cwd: process.cwd(),
  fileName: 'schema.json',
  // dialect: '2020-12',              // force one dialect
  fallbackDialect: 'draft-07', // used when `$schema` is missing
  unknownDialect: 'fallback', // or 'error'
  keywordPolicy: 'warn', // or 'error' / 'ignore'
  onDialectIssue: (issue) => console.warn(formatIssue(issue)),
});
// parse() also returns the reported issues as `issues`.
```

See [docs/dialects.md](../../docs/dialects.md) for the keyword matrix.

## Schema validation

The parser checks keywords against the dialect, but it does not reject values
with the wrong shape. Pass a validator to check every resolved document before
generation. It receives the dialect the parser resolved, so an adapter can
dispatch to the right meta-schema:

```ts
import { parse } from '@utilize/json-schema';

await parse(schema, {
  cwd: process.cwd(),
  fileName: 'schema.json',
  validateSchema: (document, { dialect, filePath }) => myValidator(document, dialect, filePath),
});
```

Return every `SchemaValidationFinding` (`pointer`, `message`, optional
`keyword`). Any finding throws `SchemaValidationError`, which carries one
report per document. The callback runs on the root, every `$ref` target and
every provided external schema the document reaches, before normalization.

An Ajv adapter is included behind the optional `ajv` peer dependency:

```ts
import { ajvValidator } from '@utilize/json-schema/validate/ajv';
```

It dispatches per dialect: draft-04, draft-06, draft-07, 2019-09 and 2020-12.
The CLIs use it for `--validate`; `--validator <module>` replaces it. Draft-04
schemas also need the optional `ajv-draft-04` package, imported only then. See
[docs/dialects.md](../../docs/dialects.md#schema-validation) for the CLI and
the module contract.

## Benchmarks

`pnpm --filter @utilize/json-schema bench` builds the package and parses two
generated large fixtures:

- an Azure-deployment-like template with a root schema and 60 linked files;
- a cyclic FHIR-like bundle with 140 resource definitions.

It runs 20 timed iterations after two warm-ups and prints median, p95, min and
max. On an Apple Silicon laptop the recorded medians were ~7.5 ms for the
60-file template and ~13.4 ms for the 140-resource bundle. Treat the numbers as
a relative baseline on your machine, not a budget.
