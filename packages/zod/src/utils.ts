import { isPlainObject, Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

export const ts = String.raw;

export const NEWLINE = '\n';

export function isSchemaObject<S = ParsedJSONSchemaObject>(schema: unknown): schema is S {
	return isPlainObject(schema);
}

/**
 * Copies the non-enumerable `Meta` from a source node to a synthetic node.
 * Generators create shallow copies while applying a type or splitting a `$ref`;
 * without `Meta` those copies would lose the dialect of their resource.
 */
export function withSourceMeta<T extends object>(
	source: ParsedJSONSchemaObject,
	value: T
): T & ParsedJSONSchemaObject {
	const meta = source[Meta];

	if (meta) {
		Object.defineProperty(value, Meta, {
			enumerable: false,
			configurable: true,
			value: meta,
		});
	}

	return value as T & ParsedJSONSchemaObject;
}
