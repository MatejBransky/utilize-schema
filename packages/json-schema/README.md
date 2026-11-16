# @utilize/json-schema

Generator-agnostic JSON Schema parser and linker. Resolves local and external
`$ref`s and prepares the schema graph for code generators by annotating each
node with metadata.

## Features

- Resolves local and external `$ref` references
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
//   reference,     // Referenced schema (when the node is a $ref)
//   isCircular,    // $ref target is already on this file's stack
//   fileName,      // Name of the JSON file
//   filePath,      // Path to the schema file
//   path,          // Path within the schema
//   resolvedName,  // Placeholder for code generators (set later)
// }
```

`isCircular` is a per-file hint: it marks a `$ref` whose target is already on
the current file's stack. A cycle that spans files, or one that goes through
references between definitions, has to be derived from the `reference` links by
the generator. `@utilize/zod` does that before sorting the dependency graph.

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

## When to use

Use this package if you need to preprocess JSON Schema for code generation,
validation, or analysis, and require robust `$ref` resolution and metadata.
