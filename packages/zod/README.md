# @utilize/zod

TypeScript/Zod code generator for JSON Schema. Converts any JSON Schema (with references, $defs, definitions) into standalone Zod schemas and TypeScript types.

## Features

- Generates standalone Zod schemas for root and all definitions
- Infers TypeScript types from Zod schemas
- Handles all $ref (local, external, cyclic)
- Topologically sorts schemas by dependency
- Supports most of JSON Schema Draft 7

## Usage

```ts
import { compile } from '@utilize/zod';

await compile({
  input: './schema.json',
  output: './schema.generated.ts',
});
```

## Output

For each standalone schema (root, $defs, definitions, referenced):

```ts
export const MyType = z.object({ ... });
export type MyType = z.infer<typeof MyType>;
```

## How it works

- Collects all standalone schemas (root, $defs, definitions, referenced)
- Builds dependency graph and sorts schemas for valid TypeScript output
- Selects the right generator for each schema node
- Emits Zod code and inferred types

## When to use

Use this package to automate Zod schema and TypeScript type generation from JSON Schema, including complex schemas with references and modular structure.

