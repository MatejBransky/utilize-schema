import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { SchemaEdge } from './collectStandaloneSchemas';

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
	const seen = new Set<ParsedJSONSchemaObject>();
	const stack = [...(adjacency.get(start) ?? [])];

	while (stack.length > 0) {
		const node = stack.pop() as ParsedJSONSchemaObject;

		if (node === target) {
			return true;
		}
		if (seen.has(node)) {
			continue;
		}

		seen.add(node);
		stack.push(...(adjacency.get(node) ?? []));
	}

	return false;
}
