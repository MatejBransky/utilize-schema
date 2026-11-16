import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

/**
 * Returns true when the schema is (transitively) a value of an object's
 * `properties` entry.
 *
 * This is the only place where the generator can emit a getter, and a getter is
 * the only way to defer a recursive reference without losing type inference.
 */
export function isPropertyBacked(schema: ParsedJSONSchemaObject): boolean {
	let node: ParsedJSONSchemaObject = schema;

	for (;;) {
		const parent = node[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			return false;
		}

		if (isPropertiesMap(parent)) {
			return true;
		}

		node = parent;
	}
}

/**
 * The linker represents `properties` as its own node, so the parent of a
 * property value is the properties map, not the enclosing schema.
 */
function isPropertiesMap(schema: ParsedJSONSchemaObject): boolean {
	const meta = schema[Meta];

	if (meta?.path.at(-1) !== 'properties') {
		return false;
	}

	const owner = meta.parent;

	return !!owner && typeof owner === 'object' && (owner.properties as unknown) === schema;
}
