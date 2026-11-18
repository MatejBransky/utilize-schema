import {
	ANNOTATION_KEYWORDS,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

/**
 * Removes an `anyOf` that every value satisfies because one of its branches
 * accepts anything, e.g. `anyOf: [X, {}]`. Such an `anyOf` never rejects a
 * value and widens the inferred type to `unknown`, so generating it would only
 * add code that has no effect.
 *
 * A `$ref` node is returned unchanged: generators track references by object
 * identity, which a copy would lose.
 */
export function withoutAlwaysValidAnyOf<T extends ParsedJSONSchemaObject>(schema: T): T {
	if (!Array.isArray(schema.anyOf) || '$ref' in schema || !schema.anyOf.some(acceptsEveryValue)) {
		return schema;
	}

	const copy = withSourceMeta(schema, { ...schema });
	delete copy.anyOf;

	return copy;
}

/** True for `true`, `{}` and a schema made of annotations only. */
function acceptsEveryValue(schema: ParsedJSONSchema): boolean {
	if (typeof schema !== 'object' || schema === null) {
		return schema === true;
	}

	return Object.keys(schema).every((keyword) => ANNOTATION_KEYWORDS.has(keyword));
}
