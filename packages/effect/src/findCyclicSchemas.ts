import { reachesThrough } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject, SchemaEdge } from '@utilize/json-schema';

/**
 * Returns the standalone schemas that take part in a reference cycle. Their
 * type depends on itself, so the generated const needs an explicit annotation
 * instead of relying on `typeof X.Type` inference.
 */
export function findCyclicSchemas(
	edges: SchemaEdge[],
	schemas: ParsedJSONSchemaObject[]
): Set<ParsedJSONSchemaObject> {
	const adjacency = new Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject[]>();

	for (const [parent, child] of edges) {
		if (parent === null) {
			continue;
		}

		const children = adjacency.get(parent);

		if (children === undefined) {
			adjacency.set(parent, [child]);
		} else if (!children.includes(child)) {
			children.push(child);
		}
	}

	return new Set(schemas.filter((schema) => reaches(adjacency, schema, schema)));
}

function reaches(
	adjacency: Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject[]>,
	start: ParsedJSONSchemaObject,
	target: ParsedJSONSchemaObject
): boolean {
	return reachesThrough(start, target, (node) => adjacency.get(node) ?? []);
}
