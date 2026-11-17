import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { GeneratorContext } from './types';

type Predicate = (input: ParsedJSONSchemaObject, context: GeneratorContext) => boolean;
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
		predicate: (input: ParsedJSONSchemaObject, context): input is T => predicate(input, context),
		generate: generate as unknown as Generate<T>,
	};
}
