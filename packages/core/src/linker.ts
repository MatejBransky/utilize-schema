import type {
	JSONSchema,
	JSONSchemaType,
	LinkedJSONSchema,
} from './types/JSONSchema';
import { Parent } from './types/JSONSchema';
import { isPlainObject } from './utils';

/**
 * Traverses over the schema, giving each node a reference to its
 * parent node. We need this for downstream operations.
 */
export function link(
	schema: JSONSchemaType | JSONSchema,
	parent: JSONSchemaType | JSONSchema | null = null
): LinkedJSONSchema {
	if (!Array.isArray(schema) && !isPlainObject(schema)) {
		return schema as LinkedJSONSchema;
	}

	// Handle cycles
	if (Object.prototype.hasOwnProperty.call(schema as JSONSchema, Parent)) {
		return schema as LinkedJSONSchema;
	}

	// Add a reference to this schema's parent
	Object.defineProperty(schema, Parent, {
		enumerable: false,
		value: parent,
		writable: false,
	});

	// Arrays
	if (Array.isArray(schema)) {
		schema.forEach((child) => link(child, schema));
	}

	// Objects
	for (const value of Object.values(schema as JSONSchema)) {
		link(value, schema);
	}

	return schema as LinkedJSONSchema;
}
