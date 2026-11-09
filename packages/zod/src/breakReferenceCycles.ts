import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

import { type SchemaEdge } from './collectStandaloneSchemas';

type SchemaNode = SchemaEdge[0];

/**
 * Finds $refs that point back to a schema on the current depth-first path,
 * marks them as circular and returns the edges without them, so the
 * remaining dependency graph has no cycles.
 */
export function breakReferenceCycles(edges: SchemaEdge[]): SchemaEdge[] {
	const edgesBySource = groupBySource(edges);
	const visited = new Set<SchemaNode>();
	const path = new Set<SchemaNode>();
	const backEdges = new Set<SchemaEdge>();

	function visit(node: SchemaNode) {
		if (visited.has(node)) return;
		visited.add(node);
		path.add(node);

		for (const edge of edgesBySource.get(node) ?? []) {
			const [, target] = edge;

			if (path.has(target) && isReference(node)) {
				node[Meta].isCircular = true;
				backEdges.add(edge);
			} else {
				visit(target);
			}
		}

		path.delete(node);
	}

	visit(null);

	return edges.filter((edge) => !backEdges.has(edge));
}

function groupBySource(edges: SchemaEdge[]) {
	const edgesBySource = new Map<SchemaNode, SchemaEdge[]>();

	for (const edge of edges) {
		const [source] = edge;
		edgesBySource.set(source, [...(edgesBySource.get(source) ?? []), edge]);
	}

	return edgesBySource;
}

function isReference(
	node: SchemaNode
): node is ParsedJSONSchemaObject & { $ref: string } {
	return node?.$ref !== undefined;
}
