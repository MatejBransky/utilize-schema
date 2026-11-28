import { schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { TYPE_KEYWORDS } from './constants';

export function remainingSchema(
	schema: ParsedJSONSchemaObject,
	keyword: 'allOf' | 'anyOf' | 'oneOf' | 'const' | 'enum'
): ParsedJSONSchemaObject {
	return {
		...schema,
		[keyword]: undefined,
	};
}

export function hasRenderableKeywords(schema: ParsedJSONSchemaObject): boolean {
	const record = schemaRecord(schema);

	for (const keyword of TYPE_KEYWORDS) {
		if (keyword === '$ref') {
			continue;
		}
		if (record[keyword] !== undefined) {
			return true;
		}
	}

	return false;
}

export function hasOnlyTypeKeyword(schema: ParsedJSONSchemaObject): boolean {
	const record = schemaRecord(schema);

	for (const keyword of TYPE_KEYWORDS) {
		if (keyword !== 'type' && record[keyword] !== undefined) {
			return false;
		}
	}

	return true;
}

export function withType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return { ...schema, type };
}

export function isScalarType(
	type: ParsedJSONSchemaObject['type']
): type is 'string' | 'number' | 'integer' | 'boolean' | 'null' {
	return (
		type === 'string' ||
		type === 'number' ||
		type === 'integer' ||
		type === 'boolean' ||
		type === 'null'
	);
}

export function isOfType(
	value: unknown,
	type: 'string' | 'number' | 'integer' | 'boolean' | 'null'
): boolean {
	switch (type) {
		case 'null':
			return value === null;
		case 'integer':
			return typeof value === 'number' && Number.isInteger(value);
		default:
			return typeof value === type;
	}
}
