# @utilize/json-schema

Generator-agnostic JSON Schema resolver with full $ref support (local, external, cyclic). Prepares JSON Schema for code generators by annotating each node with rich metadata.

## Features

- Resolves all $ref references (local, external, cyclic)
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
//   parent,        // Reference to parent schema node
//   reference,     // Referenced schema (if $ref)
//   isCircular,    // Boolean: is this a circular reference?
//   fileName,      // Name of the JSON file
//   filePath,      // Path to the schema file
//   path,          // Path within the schema
//   resolvedName,  // Placeholder for code generators (set later)
// }

## Usage

```ts
import { parse, Meta } from '@utilize/json-schema';

const { root } = await parse(schema, { cwd: process.cwd(), fileName: 'schema.json' });
console.log(root[Meta]);
```

## When to use

Use this package if you need to preprocess JSON Schema for code generation, validation, or analysis, and require robust $ref resolution and metadata.

