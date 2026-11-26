import { dialectOf, expectDefined } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject, SchemaEdge } from '@utilize/json-schema';

import { withoutAlwaysValidAnyOf } from './generators/alwaysValidAnyOf';
import { arrayGenerator } from './generators/arrayGenerator';
import { multipleTypeGenerator } from './generators/multipleTypeGenerator';
import { objectGenerator } from './generators/objectGenerator';
import { recordGenerator } from './generators/recordGenerator';
import { selectGenerator } from './generators/selectGenerator';
import { tupleGenerator } from './generators/tupleGenerator';
import { inferTypeKeywords } from './inferTypes';

type SchemaNode = SchemaEdge[0];

export interface CyclicSchemas {
	/** Standalone schemas in a cycle, which need an explicit type annotation. */
	schemas: Set<ParsedJSONSchemaObject>;
	/** Cycles with no object, array, tuple or record to anchor a value type. */
	unsupported: ParsedJSONSchemaObject[][];
}

export function findCyclicSchemas(
	edges: SchemaEdge[],
	schemas: ParsedJSONSchemaObject[]
): CyclicSchemas {
	const cyclicNodes = findCyclicNodes(edges);

	const cyclic = new Set<ParsedJSONSchemaObject>();
	const unsupported: ParsedJSONSchemaObject[][] = [];

	for (const component of cyclicNodes) {
		const members = schemas.filter((schema) => component.has(schema));

		if (members.length === 0) {
			continue;
		}

		// Check every node in the component, not only the standalone members:
		// an inline object or array can anchor a cycle even when the only
		// standalone schema in it is a union.
		if ([...component].every((node) => !isStructuralNode(node))) {
			unsupported.push(members);
			continue;
		}

		for (const member of members) {
			cyclic.add(member);
		}
	}

	return { schemas: cyclic, unsupported };
}

/**
 * True when the schema itself produces an object, array, tuple or record.
 * Typed and keyword-only structural constraints both count: the refinement
 * pipeline validates the latter behind a type guard. Subschema branches do not
 * count: a structural constructor in a sibling `anyOf` branch does not anchor a
 * cycle that bypasses it.
 */
function isStructuralNode(schema: SchemaNode): boolean {
	if (typeof schema !== 'object' || schema === null) {
		return false;
	}

	const candidate = withoutAlwaysValidAnyOf(schema);
	const dialect = dialectOf(schema);

	if (hasStructuralType(inferTypeKeywords(candidate, dialect))) {
		return true;
	}

	const generator = selectGenerator(candidate, dialect);

	if (STRUCTURAL_GENERATORS.has(generator)) {
		return true;
	}

	return (
		generator === multipleTypeGenerator &&
		hasStructuralType(Array.isArray(schema.type) ? schema.type : [schema.type])
	);
}

const STRUCTURAL_GENERATORS = new Set([
	objectGenerator,
	recordGenerator,
	arrayGenerator,
	tupleGenerator,
]);

function hasStructuralType(types: readonly (string | undefined)[]): boolean {
	return types.some((type) => type === 'object' || type === 'array');
}

function findCyclicNodes(edges: SchemaEdge[]): Set<SchemaNode>[] {
	const adjacency = new Map<SchemaNode, SchemaNode[]>();

	for (const [source, target] of edges) {
		const targets = adjacency.get(source);

		if (targets) {
			targets.push(target);
		} else {
			adjacency.set(source, [target]);
		}
	}

	let nextIndex = 0;
	const indices = new Map<SchemaNode, number>();
	const lowLinks = new Map<SchemaNode, number>();
	const stack: SchemaNode[] = [];
	const onStack = new Set<SchemaNode>();
	const components: Set<SchemaNode>[] = [];

	function connect(node: SchemaNode) {
		const index = nextIndex++;
		indices.set(node, index);
		lowLinks.set(node, index);
		stack.push(node);
		onStack.add(node);

		for (const target of adjacency.get(node) ?? []) {
			if (!indices.has(target)) {
				connect(target);
				lowLinks.set(
					node,
					Math.min(expectDefined(lowLinks.get(node)), expectDefined(lowLinks.get(target)))
				);
			} else if (onStack.has(target)) {
				lowLinks.set(
					node,
					Math.min(expectDefined(lowLinks.get(node)), expectDefined(indices.get(target)))
				);
			}
		}

		if (lowLinks.get(node) !== indices.get(node)) {
			return;
		}

		const component = popComponent(node, stack, onStack);
		const hasSelfLoop = (adjacency.get(node) ?? []).includes(node);

		if (component.size > 1 || hasSelfLoop) {
			components.push(component);
		}
	}

	for (const node of adjacency.keys()) {
		if (!indices.has(node)) {
			connect(node);
		}
	}

	return components;
}

function popComponent(
	node: SchemaNode,
	stack: SchemaNode[],
	onStack: Set<SchemaNode>
): Set<SchemaNode> {
	const component = new Set<SchemaNode>();
	let member: SchemaNode;

	do {
		const popped = stack.pop();
		if (popped === undefined) {
			throw new Error('Cyclic component stack underflow');
		}
		member = popped;
		onStack.delete(member);
		component.add(member);
	} while (member !== node);

	return component;
}
