import {
	ASTKind,
	isASTNode,
	type ASTNode,
	type IntersectionNode,
	type ObjectNode,
	type UnionNode,
} from './types/AST';
import { assert } from './utils';

/**
 * Optimizes the AST by deduplicating union/intersection members,
 * flattening where possible, and simplifying constructs such as
 * unions/intersections containing `any` or `unknown`.
 *
 * This step ensures the generated code is concise and free of duplicate exports.
 */
export function optimize(ast: ASTNode, seen = new WeakSet()): ASTNode {
	if (seen.has(ast)) {
		return ast;
	}
	seen.add(ast);

	switch (ast.kind) {
		case ASTKind.UNION: {
			// Recursively optimize all union members
			let nodes = ast.nodes.map((n) => optimize(n, seen));

			// [A, B, C, Any] -> Any
			if (nodes.some((n) => n.kind === ASTKind.ANY)) {
				return { kind: ASTKind.ANY };
			}

			// [A, B, C, Unknown] -> Unknown
			if (nodes.some((n) => n.kind === ASTKind.UNKNOWN)) {
				return { kind: ASTKind.UNKNOWN };
			}

			// Flatten nested unions: z.union([A, z.union([B, C])]) -> z.union([A, B, C])
			nodes = nodes.flatMap((n) =>
				n.kind === ASTKind.UNION ? (n as UnionNode).nodes : [n]
			);

			// [A, B, B] -> [A, B]
			nodes = deduplicate(nodes);

			// [A (named), A] -> [A (named)]
			nodes = preferNamed(nodes);

			// If only one member remains, return it directly
			if (nodes.length === 1) {
				const node = nodes.at(0);
				assert(node, 'Node should not be undefined');
				return node;
			}

			return { ...ast, nodes };
		}
		case ASTKind.INTERSECTION: {
			// Recursively optimize all intersection members
			let nodes = ast.nodes.map((n) => optimize(n, seen));

			// Flatten nested intersections: z.intersection(A, z.intersection(B, C)) -> z.intersection(A, B, C)
			nodes = nodes.flatMap((n) =>
				n.kind === ASTKind.INTERSECTION ? (n as IntersectionNode).nodes : [n]
			);

			// [A, B, B] -> [A, B]
			nodes = deduplicate(nodes);

			// [A (named), A] -> [A (named)]
			nodes = preferNamed(nodes);

			// If only one member remains, return it directly
			if (nodes.length === 1) {
				const node = nodes.at(0);
				assert(node, 'Node should not be undefined');
				return node;
			}

			return { ...ast, nodes };
		}
		case ASTKind.OBJECT: {
			return {
				...ast,
				properties: ast.properties.map((p) => ({
					...p,
					ast: optimize(p.ast, seen),
				})),
				superTypes: ast.superTypes.map((s) => optimize(s, seen) as ObjectNode),
			};
		}
		case ASTKind.ARRAY: {
			return { ...ast, items: optimize(ast.items, seen) };
		}
		case ASTKind.TUPLE: {
			return {
				...ast,
				items: ast.items.map((n) => optimize(n, seen)),
				spreadParam: ast.spreadParam
					? optimize(ast.spreadParam, seen)
					: undefined,
			};
		}
		// Add more ASTKind cases as needed
		default:
			return ast;
	}
}

export function structuralHash(
	node: ASTNode,
	seen = new WeakMap<ASTNode, string>(),
	path: string[] = []
): string {
	if (seen.has(node)) return seen.get(node)!;

	// Exclude non-structural fields
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { standaloneName, keyName, meta, ...rest } = node;

	// For primitives
	if (typeof rest !== 'object' || rest === null) {
		return String(rest);
	}

	// For cycles
	const nodeId = path.join('/');
	seen.set(node, `#cycle:${nodeId}`);

	// For arrays
	if (Array.isArray(rest)) {
		const arrHash = rest.map((item, i) =>
			typeof item === 'object' && item !== null
				? structuralHash(item, seen, path.concat(String(i)))
				: String(item)
		);
		const result = `[${arrHash.join(',')}]`;
		seen.set(node, result);
		return result;
	}

	// For objects
	const keys = Object.keys(rest).sort();
	const objHash = keys
		.map((k) => {
			const v = rest[k as keyof typeof rest];
			if (isASTNode(v)) {
				return `${k}:${structuralHash(v, seen, path.concat(k))}`;
			}
			if (Array.isArray(v)) {
				return `${k}:[${v
					.map((item, i) =>
						typeof item === 'object' && item !== null
							? structuralHash(item, seen, path.concat(k, String(i)))
							: String(item)
					)
					.join(',')}]`;
			}
			return `${k}:${String(v)}`;
		})
		.join('|');
	const result = `${node.kind}{${objHash}}`;
	seen.set(node, result);
	return result;
}

function deduplicate(nodes: ASTNode[]): ASTNode[] {
	const seen = new Set<string>();
	return nodes.filter((n) => {
		const key = structuralHash(n);

		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function preferNamed(nodes: ASTNode[]): ASTNode[] {
	const byStructure = new Map<string, ASTNode>();
	for (const n of nodes) {
		const key = structuralHash(n);
		if (
			!byStructure.has(key) ||
			(n.standaloneName && !byStructure.get(key)?.standaloneName)
		) {
			byStructure.set(key, n);
		}
	}
	return Array.from(byStructure.values());
}
