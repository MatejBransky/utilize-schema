import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { GeneratorContext } from './types';

/** Picks a generator. Only the node's dialect may change the choice. */
type Predicate = (input: ParsedJSONSchemaObject, dialect: Dialect) => boolean;
type Generate<T> = (schema: T, context: GeneratorContext) => string;

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
