import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

import { type SchemaEdge } from './collectStandaloneSchemas';
import { unsupportedCycleError } from './errors';
import { isPropertyBacked } from './isPropertyBacked';

type SchemaNode = SchemaEdge[0];

/**
 * Finds $refs that close a cycle and removes their dependency edge, so the
 * remaining graph can be topologically sorted.
 *
 * A cycle is always broken at a $ref nested in an object property: that is the
 * only place where the generator can emit a getter and defer the reference
 * without losing type inference. When a cycle never passes through an object
 * property, generation fails instead of emitting code that throws at import.
 */
export function breakReferenceCycles(edges: SchemaEdge[]): SchemaEdge[] {
	resetCircularFlags(edges);
	let remaining = edges;

	for (;;) {
		const cycle = findCycle(remaining);

		if (!cycle) {
			return remaining;
		}

		const backEdge = cycle.at(-1)!;
		const refs = cycle
			.map(([source]) => source)
			.filter(isReference)
			.filter((ref, index, all) => all.indexOf(ref) === index);

		if (refs.length === 0) {
			throw unsupportedCycleError([]);
		}

		// Prefer the edge that closes the cycle: removing it breaks this cycle
		// outright. If it cannot be deferred with a getter, look for any other
		// $ref on the cycle that can.
		const circularRef =
			isReference(backEdge[0]) && isPropertyBacked(backEdge[0])
				? backEdge[0]
				: refs.find(isPropertyBacked);

		if (!circularRef) {
			throw unsupportedCycleError(refs);
		}

		circularRef[Meta].isCircular = true;

		const breakEdge = cycle.find(([source]) => source === circularRef)!;
		remaining = remaining.filter((edge) => edge !== breakEdge);
	}
}

/**
 * The linker marks a $ref as circular when its target is already on the file
 * stack. That is only a hint: cycles are re-derived from the whole dependency
 * graph here, so stale flags have to be cleared first.
 */
function resetCircularFlags(edges: SchemaEdge[]) {
	const refs = new Set<ParsedJSONSchemaObject>();

	for (const [source, target] of edges) {
		if (isReference(source)) {
			refs.add(source);
		}
		if (isReference(target)) {
			refs.add(target);
		}
	}

	for (const ref of refs) {
		ref[Meta].isCircular = false;
	}
}

/**
 * Returns the edges of the first cycle found by a depth-first search, with the
 * edge that closes the cycle last, or null when the graph is acyclic.
 */
function findCycle(edges: SchemaEdge[]): SchemaEdge[] | null {
	const edgesBySource = groupBySource(edges);
	const visited = new Set<SchemaNode>();
	const pathNodes: SchemaNode[] = [];
	const pathEdges: SchemaEdge[] = [];

	function visit(node: SchemaNode): SchemaEdge[] | null {
		visited.add(node);
		pathNodes.push(node);

		for (const edge of edgesBySource.get(node) ?? []) {
			const target = edge[1];
			const cycleStart = pathNodes.indexOf(target);

			if (cycleStart !== -1) {
				return [...pathEdges.slice(cycleStart), edge];
			}

			if (visited.has(target)) {
				continue;
			}

			pathEdges.push(edge);
			const cycle = visit(target);

			if (cycle) {
				return cycle;
			}

			pathEdges.pop();
		}

		pathNodes.pop();
		return null;
	}

	for (const node of edgesBySource.keys()) {
		if (visited.has(node)) {
			continue;
		}

		const cycle = visit(node);

		if (cycle) {
			return cycle;
		}
	}

	return null;
}

function groupBySource(edges: SchemaEdge[]) {
	const edgesBySource = new Map<SchemaNode, SchemaEdge[]>();

	for (const edge of edges) {
		const [source] = edge;
		const sourceEdges = edgesBySource.get(source);

		if (sourceEdges) {
			sourceEdges.push(edge);
		} else {
			edgesBySource.set(source, [edge]);
		}
	}

	return edgesBySource;
}

function isReference(node: SchemaNode): node is ParsedJSONSchemaObject & { $ref: string } {
	return typeof node === 'object' && node !== null && '$ref' in node;
}
