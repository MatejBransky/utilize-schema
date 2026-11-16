import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

/**
 * Returns true when the schema is (transitively) a value of an object's
 * `properties` entry.
 *
 * This is the only place where the generator can emit a getter, and a getter is
 * the only way to defer a recursive reference without losing type inference.
 */
export function isPropertyBacked(
	schema: ParsedJSONSchemaObject,
	standaloneSchemas?: Set<ParsedJSONSchemaObject>
): boolean {
	let node: ParsedJSONSchemaObject = schema;

	for (;;) {
		const parent = node[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			return false;
		}

		if (isPropertiesMap(parent)) {
			if (!standaloneSchemas) {
				return true;
			}

			const owner = parent[Meta]?.parent;

			if (!owner || typeof owner !== 'object') {
				return false;
			}

			return (
				nearestStandalone(schema, standaloneSchemas) === nearestStandalone(owner, standaloneSchemas)
			);
		}

		node = parent;
	}
}

function nearestStandalone(
	node: ParsedJSONSchemaObject,
	standaloneSchemas: Set<ParsedJSONSchemaObject>
): ParsedJSONSchemaObject | undefined {
	let current: ParsedJSONSchemaObject = node;

	for (;;) {
		if (standaloneSchemas.has(current)) {
			return current;
		}

		const parent = current[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			return undefined;
		}

		current = parent;
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
