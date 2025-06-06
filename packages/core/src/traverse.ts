import {
	Intersection,
	type LinkedJSONSchema,
	type NormalizedJSONSchema,
} from './types/JSONSchema';

// keys that shouldn't be traversed by the catchall step
const BLACKLISTED_KEYS = new Set([
	'id',
	'$defs',
	'$id',
	'$schema',
	'title',
	'description',
	'default',
	'multipleOf',
	'maximum',
	'exclusiveMaximum',
	'minimum',
	'exclusiveMinimum',
	'maxLength',
	'minLength',
	'pattern',
	'additionalItems',
	'items',
	'maxItems',
	'minItems',
	'uniqueItems',
	'maxProperties',
	'minProperties',
	'required',
	'additionalProperties',
	'definitions',
	'properties',
	'patternProperties',
	'dependencies',
	'enum',
	'type',
	'allOf',
	'anyOf',
	'oneOf',
	'not',
]);

// Arguments for the traverse function
export type TraverseArgs = {
	schema: LinkedJSONSchema;
	callback: (schema: LinkedJSONSchema, key: string | null) => void;
	processed?: Set<LinkedJSONSchema>;
	key?: string;
};

/**
 * Traverses a LinkedJSONSchema tree and invokes a callback for each schema node.
 *
 * This traversal is a core utility for any generator pipeline that transforms or
 * analyzes JSON Schema. It enables normalization, enrichment, and transformation
 * of schema structures before code generation. By visiting every relevant node
 * (object, array, union, etc.), it allows rules and generators to annotate,
 * rewrite, or analyze the schema in a consistent and extensible way.
 *
 * The traversal covers all standard JSON Schema constructs, including properties,
 * patternProperties, items, additionalProperties, allOf, anyOf, oneOf, not,
 * definitions, $defs, dependencies, and intersection schemas. Cyclic references
 * are handled and each schema node is visited only once.
 */
export function traverse({
	schema,
	callback,
	processed = new Set<LinkedJSONSchema>(),
	key,
}: TraverseArgs): void {
	// Handle recursive schemas
	if (processed.has(schema)) {
		return;
	}

	processed.add(schema);
	callback(schema, key ?? null);

	if (schema.anyOf) {
		traverseArray(schema.anyOf, callback, processed);
	}
	if (schema.allOf) {
		traverseArray(schema.allOf, callback, processed);
	}
	if (schema.oneOf) {
		traverseArray(schema.oneOf, callback, processed);
	}
	if (schema.properties) {
		traverseObjectKeys(schema.properties, callback, processed);
	}
	if (schema.patternProperties) {
		traverseObjectKeys(schema.patternProperties, callback, processed);
	}
	if (
		schema.additionalProperties &&
		typeof schema.additionalProperties === 'object'
	) {
		traverse({ schema: schema.additionalProperties, callback, processed });
	}
	if (schema.items) {
		const { items } = schema;
		if (Array.isArray(items)) {
			traverseArray(items, callback, processed);
		} else {
			traverse({ schema: items, callback, processed });
		}
	}
	if (schema.additionalItems && typeof schema.additionalItems === 'object') {
		traverse({ schema: schema.additionalItems, callback, processed });
	}
	if (schema.dependencies) {
		if (Array.isArray(schema.dependencies)) {
			traverseArray(schema.dependencies, callback, processed);
		} else {
			const dependencies = schema.dependencies as Record<
				string,
				LinkedJSONSchema
			>;
			traverseObjectKeys(dependencies, callback, processed);
		}
	}
	if (schema.definitions) {
		traverseObjectKeys(schema.definitions, callback, processed);
	}
	if (schema.$defs) {
		traverseObjectKeys(schema.$defs, callback, processed);
	}
	if (schema.not) {
		traverse({ schema: schema.not, callback, processed });
	}
	traverseIntersection(schema, callback, processed);

	// technically you can put definitions on any key
	Object.entries(schema)
		.filter(([key]) => !BLACKLISTED_KEYS.has(key))
		.forEach(([, child]) => {
			if (child && typeof child === 'object') {
				traverseObjectKeys(child, callback, processed);
			}
		});
}

function traverseArray(
	arr: LinkedJSONSchema[],
	callback: (schema: LinkedJSONSchema, key: string | null) => void,
	processed: Set<LinkedJSONSchema>
) {
	arr.forEach((schema, k) =>
		traverse({ schema, callback, processed, key: k.toString() })
	);
}

function traverseIntersection(
	schema: LinkedJSONSchema,
	callback: (schema: LinkedJSONSchema, key: string | null) => void,
	processed: Set<LinkedJSONSchema>
) {
	if (typeof schema !== 'object' || !schema) {
		return;
	}

	const r = schema as unknown as Record<string | symbol, unknown>;
	const intersection = r[Intersection] as NormalizedJSONSchema | undefined;
	if (!intersection) {
		return;
	}

	if (Array.isArray(intersection.allOf)) {
		traverseArray(intersection.allOf, callback, processed);
	}
}

function traverseObjectKeys(
	obj: Record<string, LinkedJSONSchema>,
	callback: (schema: LinkedJSONSchema, key: string | null) => void,
	processed: Set<LinkedJSONSchema>
) {
	Object.keys(obj).forEach((key) => {
		if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
			traverse({ schema: obj[key], callback, processed, key });
		}
	});
}
