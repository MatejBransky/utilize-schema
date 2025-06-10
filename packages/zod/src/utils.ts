import {
	ASTKind,
	type ASTNode,
	type ASTNodeWithStandaloneName,
} from '@utilize/json-schema-core';

export function collectSchemasInDependencyOrder(
	root: ASTNode,
	visited = new Set<ASTNodeWithStandaloneName>(),
	order: ASTNodeWithStandaloneName[] = [],
	stack = new Set<ASTNode>()
): ASTNodeWithStandaloneName[] {
	if (stack.has(root)) {
		return order;
	}
	stack.add(root);

	const visit = (child: ASTNode) => {
		if (hasStandaloneName(child)) {
			collectSchemasInDependencyOrder(child, visited, order, stack);
		} else {
			traverseChildren(child, (nested) =>
				collectSchemasInDependencyOrder(nested, visited, order, stack)
			);
		}
	};

	traverseChildren(root, visit);

	if (hasStandaloneName(root) && !visited.has(root)) {
		visited.add(root);
		order.push(root);
	}

	return order;
}

export function traverseChildren(
	ast: ASTNode,
	visit: (child: ASTNode) => void
) {
	switch (ast.kind) {
		case ASTKind.OBJECT:
			for (const superType of ast.superTypes) {
				visit(superType);
			}
			for (const { ast: property } of ast.properties) {
				visit(property);
			}
			break;
		case ASTKind.ARRAY:
			visit(ast.items);
			break;
		case ASTKind.UNION:
		case ASTKind.INTERSECTION:
			for (const node of ast.nodes) {
				visit(node);
			}
			break;
		case ASTKind.TUPLE:
			for (const node of ast.items) {
				visit(node);
			}
			if ('spreadParam' in ast && ast.spreadParam) {
				visit(ast.spreadParam);
			}
			break;
	}
}

function hasStandaloneName(ast: ASTNode): ast is ASTNodeWithStandaloneName {
	return 'standaloneName' in ast && typeof ast.standaloneName === 'string';
}
