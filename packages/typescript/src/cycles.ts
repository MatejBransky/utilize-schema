import { isPlainObject, Meta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

/**
 * Schemas that take part in a `$ref` cycle which TypeScript cannot express.
 *
 * An object, array or tuple defers references inside it, so a cycle that passes
 * through one of those is a valid recursive type. A cycle that only passes
 * through `$ref` aliases, `allOf`, `anyOf` or `oneOf` renders as a type alias
 * that references itself directly, which TypeScript rejects as circular.
 */
export function findUnsupportedCycles(
	schemas: ParsedJSONSchemaObject[]
): ParsedJSONSchemaObject[][] {
	return schemas.flatMap((schema) => (reachesTransparently(schema, schema) ? [[schema]] : []));
}

/**
 * Follows the positions whose rendered type is transparent: `$ref` targets and
 * composition members. Property, item and index positions are deferred by
 * TypeScript, so they stop the walk.
 */
function reachesTransparently(
	start: ParsedJSONSchemaObject,
	target: ParsedJSONSchemaObject
): boolean {
	const seen = new Set<ParsedJSONSchemaObject>();
	const stack = transparentChildren(start);

	while (stack.length > 0) {
		const node = stack.pop()!;

		if (node === target) {
			return true;
		}
		if (seen.has(node)) {
			continue;
		}

		seen.add(node);
		stack.push(...transparentChildren(node));
	}

	return false;
}

function transparentChildren(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] {
	const children: ParsedJSONSchemaObject[] = [];

	if (typeof schema.$ref === 'string') {
		const referenced = schema[Meta]?.reference;

		if (isPlainObject(referenced)) {
			children.push(referenced as ParsedJSONSchemaObject);
		}
	}

	for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
		const members = schema[keyword];

		if (Array.isArray(members)) {
			children.push(
				...(members as unknown as ParsedJSONSchema[]).filter(
					(member): member is ParsedJSONSchemaObject => isPlainObject(member)
				)
			);
		}
	}

	return children;
}
