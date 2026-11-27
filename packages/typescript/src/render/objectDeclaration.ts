import { schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { InferenceMode } from './context';
import { inferFamily } from './keywords';

/**
 * True when the schema renders as an interface: an object with no composition.
 * Interfaces with an index signature can be recursive; `Record` aliases cannot.
 */
export function isObjectDeclaration(
	schema: ParsedJSONSchemaObject,
	inference?: InferenceMode
): boolean {
	if (typeof schema.$ref === 'string' || Object.hasOwn(schema, 'const')) {
		return false;
	}
	if (Array.isArray(schema.enum) || Array.isArray(schema.type)) {
		return false;
	}
	if (
		(Array.isArray(schema.allOf) && schema.allOf.length > 0) ||
		Array.isArray(schema.anyOf) ||
		Array.isArray(schema.oneOf)
	) {
		return false;
	}

	return (
		schema.type === 'object' ||
		(schema.type === undefined && inferFamily(schemaRecord(schema), inference) === 'object')
	);
}
