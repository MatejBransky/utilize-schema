import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { GeneratorContext } from './types';

/** Picks a generator. Only the node's dialect may change the choice. */
export type Predicate = (input: ParsedJSONSchemaObject, dialect: Dialect) => boolean;

/**
 * What a keyword generator calls for its subschemas. `generateSchema` passes
 * it in, so the generator modules do not import `generateSchema` or
 * `selectGenerator`, which both import the generators.
 */
export type Recursion = {
	generateSchema: (schema: ParsedJSONSchema | undefined, context: GeneratorContext) => string;
	selectGenerator: (input: ParsedJSONSchemaObject, dialect: Dialect) => ExpressionGenerator;
};

export type Generate<T> = (schema: T, context: GeneratorContext, recursion: Recursion) => string;

export type ExpressionGenerator<T = ParsedJSONSchemaObject> = {
	predicate: Predicate;
	generate: Generate<T>;
};

export function createGenerator<
	R extends Partial<ParsedJSONSchemaObject> = ParsedJSONSchemaObject,
	T extends ParsedJSONSchemaObject = ParsedJSONSchemaObject,
>(predicate: Predicate, generate: Generate<R>): ExpressionGenerator<T> {
	return {
		predicate: (input: ParsedJSONSchemaObject, dialect): input is T => predicate(input, dialect),
		generate: generate as unknown as Generate<T>,
	};
}
