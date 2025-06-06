/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * This type will be used as the intermediate representation
 * between normalized JSON Schema and runtime validation code generators (e.g., Zod, ArkType).
 *
 * Design note:
 * The AST structure will be developed iteratively, driven by the needs of the code generator(s).
 * Instead of designing the AST in isolation, we will first write tests for the generator (e.g., Zod generator)
 * using hand-crafted AST nodes as input and expected code as output. As generator requirements become clear,
 * the AST node types and structure will be refined to support all necessary features for runtime validation
 * and type inference.
 *
 * This approach ensures the AST is minimal, practical, and tailored to real-world code generation needs,
 * avoiding overengineering and premature abstraction.
 *
 * The parser, which transforms normalized JSON Schema into AST, will be implemented only after the generator's
 * requirements are well understood.
 */
export type ASTNode = any;
