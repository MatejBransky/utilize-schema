# AST Design and Iterative Approach – Quick Recap

## Preliminary AST Proposal

The AST (Abstract Syntax Tree) is intended as an intermediate representation between normalized JSON Schema (draft-07) and runtime validation code generators (such as Zod or ArkType). The AST should:

- Represent all JSON Schema constructs relevant for runtime validation and type inference.
- Preserve constraints and metadata not expressible in TypeScript types alone (e.g., min/max, pattern, format, default, enum, nullable, etc.).
- Be generator-agnostic, so it can support Zod, ArkType, or other validators.

**Example (preliminary) AST node types:**

```typescript
interface BaseASTNode {
  kind: string; // e.g. "string", "object", "union", ...
  title?: string;
  description?: string;
  deprecated?: boolean;
  default?: unknown;
  examples?: unknown[];
  nullable?: boolean;
  runtime?: Record<string, unknown>; // runtime constraints
  meta?: { provenance?: string }; // e.g. original $ref path
}

interface StringNode extends BaseASTNode {
  kind: "string";
  runtime?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
  };
}

interface NumberNode extends BaseASTNode {
  kind: "number" | "integer";
  runtime?: {
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
  };
}

// ...and so on for boolean, null, enum, literal, array, tuple, object, union, intersection, not, anyOf, oneOf, ref
```

## My Reasoning (Why Not Implement the AST Immediately?)

- The AST is not the end product; it is only useful if it meets the needs of the code generator (e.g., Zod generator).
- Without understanding the generator’s requirements, it’s easy to overengineer or miss important edge cases.
- Therefore, I will **not** implement the AST up front.

## My Approach

1. **Start with generator tests:**  
   I will write tests for the Zod generator using hand-crafted AST nodes as input and expected Zod code as output (using the `ts` utility for formatting).
2. **Let requirements emerge:**  
   As I implement the generator to pass these tests, I will discover what information the AST must carry and how it should be structured.
3. **Iteratively refine the AST:**  
   The AST node types and structure will be updated as new generator requirements and edge cases are discovered.
4. **Compare with bcherny/json-schema-to-typescript:**  
   I will continuously compare my approach and coverage with the legacy project to ensure I don’t miss key scenarios or edge cases.

## Key Takeaways

- The AST should be minimal, practical, and tailored to real-world code generation needs.
- The parser (which transforms normalized JSON Schema into AST) will be implemented only after the generator’s requirements are well understood.
- This iterative, test-driven approach avoids premature abstraction and ensures the AST is fit for purpose.

---
