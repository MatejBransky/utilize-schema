import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { GeneratorContext } from './types';

/** Narrows the parsed node to the shape a generator reads. */
export type Predicate<T extends ParsedJSONSchemaObject = ParsedJSONSchemaObject> = (
	input: ParsedJSONSchemaObject,
	dialect: Dialect
) => input is T;

export type Generate<T extends ParsedJSONSchemaObject = ParsedJSONSchemaObject> = (
	schema: T,
	context: GeneratorContext,
	recursion: Recursion
) => string;

/**
 * What a keyword generator calls for its subschemas. `generateSchema` passes
 * it in, so the generator modules do not import `generateSchema` or
 * `selectGenerator`, which both import the generators.
 */
export type Recursion = {
	generateSchema: (schema: ParsedJSONSchema | undefined, context: GeneratorContext) => string;
	selectGenerator: (input: ParsedJSONSchemaObject, dialect: Dialect) => ExpressionGenerator;
};

export type ExpressionGenerator = {
	predicate: Predicate;
	generate: Generate;
};

/**
 * Builds a generator from its narrowing predicate. The returned `generate`
 * checks the predicate before calling the narrow implementation, so erasing
 * the generator's node type is safe: callers only reach the implementation
 * when the predicate has actually narrowed the input.
 */
export function createGenerator<T extends ParsedJSONSchemaObject = ParsedJSONSchemaObject>(
	predicate: Predicate<T>,
	generate: Generate<T>
): ExpressionGenerator {
	return {
		predicate,
		generate(schema, context, recursion) {
			if (!predicate(schema, context.dialect)) {
				throw new Error('Generator selected for a schema its predicate does not match.');
			}

			return generate(schema, context, recursion);
		},
	};
}
