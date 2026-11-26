import { isParsedJSONSchemaObject, Meta, reachesThrough } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

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
	const cycles: ParsedJSONSchemaObject[][] = [];

	for (const schema of schemas) {
		if (reachesTransparently(schema, schema)) {
			cycles.push([schema]);
		}
	}

	return cycles;
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
	return reachesThrough(start, target, transparentChildren);
}

function transparentChildren(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] {
	const children: ParsedJSONSchemaObject[] = [];

	if (typeof schema.$ref === 'string') {
		const referenced = schema[Meta]?.reference;

		if (isParsedJSONSchemaObject(referenced)) {
			children.push(referenced);
		}
	}

	for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
		const members = schema[keyword];

		if (Array.isArray(members)) {
			children.push(...members.filter(isParsedJSONSchemaObject));
		}
	}

	return children;
}
