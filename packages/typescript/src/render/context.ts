import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

export type InferenceMode = 'spec' | 'pragmatic';

export interface TypeContext {
	/** Name of an already declared standalone schema. */
	nameOf(schema: ParsedJSONSchemaObject, ref: string): string;
	/** Emits a caller-provided TypeScript type for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/** How an untyped schema is narrowed; `spec` keeps scalar keywords as `unknown`. */
	inference?: InferenceMode;
}

/** Returns a type for a schema node, or `undefined` to use the renderer. */
export type CustomSchemaResolver = (schema: ParsedJSONSchemaObject) => string | undefined;

/**
 * Renders a nested schema. Helpers take it as an argument so they can render
 * children without importing the dispatcher and creating a cycle.
 */
export type RenderNested = (
	schema: ParsedJSONSchema | undefined,
	context: TypeContext,
	level: number
) => string;
