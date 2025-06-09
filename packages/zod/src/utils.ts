import {
	ASTKind,
	ASTNode,
	ASTNodeWithStandaloneName,
} from '@utilize/json-schema-core';

export function collectSchemasInDependencyOrder(
	root: ASTNode,
	visited = new Set<ASTNodeWithStandaloneName>(),
	order: ASTNodeWithStandaloneName[] = [],
	stack = new Set<ASTNode>()
): ASTNodeWithStandaloneName[] {
	if (stack.has(root)) return order;
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
			for (const { ast: paramAst } of ast.params) {
				visit(paramAst);
			}
			break;
		case ASTKind.ARRAY:
			visit(ast.params);
			break;
		case ASTKind.UNION:
		case ASTKind.INTERSECTION:
		case ASTKind.TUPLE:
			for (const param of ast.params) visit(param);
			if ('spreadParam' in ast && ast.spreadParam) visit(ast.spreadParam);
			break;
		case ASTKind.ENUM:
			for (const { ast: literal } of ast.params) visit(literal);
			break;
	}
}

function hasStandaloneName(ast: ASTNode): ast is ASTNodeWithStandaloneName {
	return 'standaloneName' in ast && typeof ast.standaloneName === 'string';
}
