import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

export function declaredKeys(schema: ParsedJSONSchemaObject): string[] {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};

	return [...new Set([...Object.keys(properties), ...requiredKeys(schema)])];
}

export function requiredKeys(schema: ParsedJSONSchemaObject): Set<string> {
	return new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === 'string')
			: []
	);
}
