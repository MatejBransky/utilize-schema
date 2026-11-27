import { isParsedJSONSchema, isPlainObject, schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

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

/** JSON Schema patterns are unanchored ECMA-262 regular expressions. */
export function matchesPattern(pattern: string, key: string): boolean {
	try {
		return new RegExp(pattern).test(key);
	} catch {
		return false;
	}
}

/** `patternProperties` entries, including boolean subschemas the model type omits. */
export function patternEntries(schema: ParsedJSONSchemaObject): [string, ParsedJSONSchema][] {
	const patterns = schemaRecord(schema)['patternProperties'];

	if (!isPlainObject(patterns)) {
		return [];
	}

	return Object.entries(patterns).filter((entry): entry is [string, ParsedJSONSchema] =>
		isParsedJSONSchema(entry[1])
	);
}
