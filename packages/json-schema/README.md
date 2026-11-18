# @utilize/json-schema

Generator-agnostic JSON Schema parser and linker. Resolves local and external
`$ref`s and prepares the schema graph for code generators by annotating each
node with metadata.

## Features

- Resolves local and external `$ref` references, including `$ref` to boolean schemas
- Links recursive graphs without expanding them infinitely
- Annotates every schema node with metadata for downstream generators
- No code generation – just robust schema preparation

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

## Usage

```ts
import { parse, Meta } from '@utilize/json-schema';

const { root } = await parse(schema, {
	cwd: process.cwd(),
	fileName: 'schema.json',
});
console.log(root[Meta]);
```

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

## When to use

Use this package if you need to preprocess JSON Schema for code generation,
validation, or analysis, and require robust `$ref` resolution and metadata.
