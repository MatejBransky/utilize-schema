import {
	isCompound,
	type JSONSchema,
	type SchemaType,
} from './types/JSONSchema';
import { isPlainObject } from './utils';

const matchers: Record<SchemaType, (schema: JSONSchema) => boolean> = {
	ALL_OF(schema) {
		return 'allOf' in schema;
	},
	ANY(schema) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { $id, title, description, ...coreSchema } = schema;
		if (Object.keys(coreSchema).length === 0) {
			// The empty schema {} validates any value
			// @see https://json-schema.org/draft-07/json-schema-core.html#rfc.section.4.3.1
			return true;
		}
		return false;
	},
	ANY_OF(schema) {
		return 'anyOf' in schema;
	},
	BOOLEAN(schema) {
		if ('enum' in schema) return false;

		if (schema.type === 'boolean') return true;

		if (!isCompound(schema) && typeof schema.default === 'boolean') return true;

		return false;
	},
	CONST(schema) {
		return 'const' in schema;
	},
	NAMED_SCHEMA(schema) {
		// 8.2.1. The presence of "$id" in a subschema indicates that the subschema constitutes a distinct schema resource within a single schema document.
		return (
			'$id' in schema &&
			('patternProperties' in schema || 'properties' in schema) &&
			schema.type === 'object'
		);
	},
	NULL(schema) {
		return schema.type === 'null';
	},
	INTEGER(schema) {
		if ('enum' in schema) return false;

		if (schema.type === 'integer') return true;

		return false;
	},
	NUMBER(schema) {
		if ('enum' in schema) return false;

		if (schema.type === 'number') return true;

		if (!isCompound(schema) && typeof schema.default === 'number') return true;

		return false;
	},
	OBJECT(schema) {
		return (
			schema.type === 'object' &&
			!isPlainObject(schema.additionalProperties) &&
			!schema.allOf &&
			!schema.anyOf &&
			!schema.oneOf &&
			!schema.patternProperties &&
			!schema.properties &&
			!schema.required
		);
	},
	ONE_OF(schema) {
		return 'oneOf' in schema;
	},
	REFERENCE(schema) {
		return '$ref' in schema;
	},
	STRING(schema) {
		if ('enum' in schema) return false;

		if (schema.type === 'string') return true;

		if (!isCompound(schema) && typeof schema.default === 'string') return true;

		return false;
	},
	TYPED_ARRAY(schema) {
		if (schema.type && schema.type !== 'array') return false;

		return 'items' in schema;
	},
	UNION(schema) {
		return Array.isArray(schema.type);
	},
	UNNAMED_ENUM(schema) {
		if (
			schema.type &&
			schema.type !== 'boolean' &&
			schema.type !== 'integer' &&
			schema.type !== 'number' &&
			schema.type !== 'string'
		) {
			return false;
		}

		return 'enum' in schema;
	},
	UNNAMED_SCHEMA() {
		return false; // Explicitly handled as the default case
	},
	UNTYPED_ARRAY(schema) {
		return schema.type === 'array' && !('items' in schema);
	},
};

/**
 * Duck types a JSONSchema schema or property to determine which kind of AST node to parse it into.
 *
 * Due to what some might say is an oversight in the JSON-Schema spec, a given schema may
 * implicitly be an *intersection* of multiple JSON-Schema directives (ie. multiple TypeScript
 * types). The spec leaves it up to implementations to decide what to do with this
 * loosely-defined behavior.
 */
export function typesOfSchema(
	schema: JSONSchema
): readonly [SchemaType, ...SchemaType[]] {
	// Collect matched types
	const matchedTypes: SchemaType[] = [];
	for (const [schemaType, match] of Object.entries(matchers)) {
		if (match(schema)) {
			matchedTypes.push(schemaType as SchemaType);
		}
	}

	// Default to an unnamed schema
	if (!matchedTypes.length) return ['UNNAMED_SCHEMA'];

	return matchedTypes as [SchemaType, ...SchemaType[]];
}
