import { describe, expect, it } from 'vitest';

import {
	type ArrayNode,
	type ASTNode,
	type UnionNode,
	ASTKind,
	logger,
	optimize,
} from '../src';

const log = logger.withNamespace('optimizer:test');

function node(kind: ASTKind, extra: Partial<ASTNode> = {}): ASTNode {
	return { kind, ...extra } as ASTNode;
}

describe('optimizer', () => {
	it('optimizes a simple union', () => {
		const ast: UnionNode = {
			kind: ASTKind.UNION,
			nodes: [node(ASTKind.STRING), node(ASTKind.STRING)],
		};
		const result = optimize(ast);
		expect(result.kind).toEqual(ASTKind.STRING);
	});

	it('deduplicates identical union members', () => {
		const ast: UnionNode = {
			kind: ASTKind.UNION,
			nodes: [node(ASTKind.STRING), node(ASTKind.STRING), node(ASTKind.NUMBER)],
		};
		const result = optimize(ast) as UnionNode;
		expect(result.nodes.map((node) => node.kind)).toEqual([
			ASTKind.STRING,
			ASTKind.NUMBER,
		]);
	});

	it('deduplicates identical intersection members', () => {
		const ast: ASTNode = {
			kind: ASTKind.INTERSECTION,
			nodes: [node(ASTKind.NUMBER), node(ASTKind.NUMBER)],
		};
		const result = optimize(ast);
		expect(result.kind).toBe(ASTKind.NUMBER);
	});

	it('prefers named node over anonymous in union', () => {
		const named = node(ASTKind.STRING, { standaloneName: 'Named' });
		const anon = node(ASTKind.STRING);
		const ast: ASTNode = {
			kind: ASTKind.UNION,
			nodes: [named, anon],
		};
		const result = optimize(ast);
		expect(result).toEqual<ASTNode>({
			kind: ASTKind.STRING,
			standaloneName: 'Named',
		});
	});

	it('optimizes deeply nested structures recursively', () => {
		const ast: ArrayNode = {
			kind: ASTKind.ARRAY,
			items: {
				kind: ASTKind.UNION,
				nodes: [
					node(ASTKind.NUMBER),
					{
						kind: ASTKind.UNION,
						nodes: [node(ASTKind.NUMBER), node(ASTKind.STRING)],
					} as ASTNode,
				],
			},
		};
		const result = optimize(ast);
		if (result.items.kind === ASTKind.UNION) {
			expect(result.items.nodes.length).toBe(2);
			const kinds = result.items.nodes.map((n: ASTNode) => n.kind);
			expect(kinds.sort()).toEqual([ASTKind.NUMBER, ASTKind.STRING].sort());
		} else {
			log.error('Expected items to be a union, got:', result.items);
		}
	});
});
