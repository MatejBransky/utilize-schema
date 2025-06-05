<!--toc:start-->

- [1. **Dereferencer**](#1-dereferencer)
- [2. **Linker**](#2-linker)
- [3. **Normalizer**](#3-normalizer)
- [4. **Parser**](#4-parser)
- [5. **Optimizer**](#5-optimizer)
- [6. **Generator (Zod Generator)**](#6-generator-zod-generator)
- [7. **CLI**](#7-cli)
<!--toc:end-->

Here is a step-by-step plan for implementing "JSON Schema to Zod generator" as described:

#### 1. **Dereferencer**

- Use `@apidevtools/json-schema-ref-parser` to resolve all `$ref` references in the input JSON Schema.

#### 2. **Linker**

- Traverse the dereferenced schema.
- For each node, add a reference to its parent node (e.g., using a unique symbol like `Parent`).
- This enables easy navigation and context-aware processing in later steps.

#### 3. **Normalizer**

- Normalize the schema structure:
  - Ensure all schemas use consistent property names and types.
  - Fill in missing defaults, expand shorthand notations, and resolve ambiguities.
- This step simplifies downstream processing by making schemas more predictable.

#### 4. **Parser**

- Convert the normalized schema into an intermediate representation (AST).
- The AST should capture all necessary information for code generation (types, constraints, relationships).

#### 5. **Optimizer**

- Analyze and optimize the AST:
  - Remove redundant nodes.
  - Merge similar types.
  - Simplify constructs where possible to produce cleaner output.

#### 6. **Generator (Zod Generator)**

- Walk the optimized AST and generate Zod schema code.
- Ensure correct order of type declarations (handle dependencies).
- Output the result as a stringified TypeScript code.

#### 7. **CLI**

- Build a command-line interface that:
  - Accepts a JSON Schema file as input.
  - Runs the above pipeline.
  - Writes the generated Zod schemas to a TypeScript file.
