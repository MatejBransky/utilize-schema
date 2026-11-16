import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { SchemaEdge } from './collectStandaloneSchemas';
import { generator as allOfGenerator } from './generators/allOfGenerator';
import { generator as anyOfGenerator } from './generators/anyOfGenerator';
import { generator as arrayGenerator } from './generators/arrayGenerator';
import { generator as multipleTypeGenerator } from './generators/multipleTypeGenerator';
import { generator as objectGenerator } from './generators/objectGenerator';
import { generator as oneOfGenerator } from './generators/oneOfGenerator';
import { generator as recordGenerator } from './generators/recordGenerator';
import { selectGenerator } from './generators/selectGenerator';
import { generator as tupleGenerator } from './generators/tupleGenerator';

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

		if (members.every((member) => !hasStructuralConstructor(member))) {
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
 * True when the schema (or one of its subschemas) produces an object, array,
 * tuple or record. Those are the only constructors TypeScript can use to defer
 * a recursive type alias.
 */
function hasStructuralConstructor(schema: ParsedJSONSchemaObject): boolean {
	const generator = selectGenerator(schema);

	if (
		generator === objectGenerator ||
		generator === recordGenerator ||
		generator === arrayGenerator ||
		generator === tupleGenerator
	) {
		return true;
	}

	if (generator === multipleTypeGenerator) {
		return (schema.type as unknown as string[]).some((type) =>
			hasStructuralConstructor({
				...schema,
				type,
				default: undefined,
				title: undefined,
			} as ParsedJSONSchemaObject)
		);
	}

	if (
		generator === anyOfGenerator ||
		generator === oneOfGenerator ||
		generator === allOfGenerator
	) {
		const subschemas = schema.anyOf ?? schema.oneOf ?? schema.allOf ?? [];

		return subschemas.some(hasStructuralConstructor);
	}

	return false;
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
				lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!));
			} else if (onStack.has(target)) {
				lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!));
			}
		}

		if (lowLinks.get(node) !== indices.get(node)) {
			return;
		}

		const component = new Set<SchemaNode>();
		let member: SchemaNode;

		do {
			member = stack.pop()!;
			onStack.delete(member);
			component.add(member);
		} while (member !== node);

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
