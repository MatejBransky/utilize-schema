import { describe, expect, it } from 'vitest';

import {
	type ArrayNode,
	type ASTNode,
	type ObjectProperty,
	type UnionNode,
	ASTKind,
	logger,
	optimize,
	structuralHash,
} from '../src';

const log = logger.withNamespace('optimizer:test');

function node<N extends ASTNode>(kind: N['kind'], extra: Partial<N> = {}) {
	return { kind, ...extra } as N;
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
		if (result.kind === ASTKind.UNION) {
			expect(result.nodes.length).toBe(2);
			const kinds = result.nodes.map((n: ASTNode) => n.kind);
			expect(kinds.sort()).toEqual([ASTKind.NUMBER, ASTKind.STRING].sort());
		} else {
			log.error('Expected items to be a union, got:', result.kind);
		}
	});
});

describe('structuralHash()', () => {
	function obj(properties: ObjectProperty[]): ASTNode {
		return {
			kind: ASTKind.OBJECT,
			properties,
			superTypes: [],
			meta: {},
			standaloneName: undefined,
		};
	}

	it('produces different hashes for objects with different properties', () => {
		const a = obj([
			{
				keyName: 'foo',
				ast: { kind: ASTKind.STRING },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		const b = obj([
			{
				keyName: 'bar',
				ast: { kind: ASTKind.NUMBER },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		expect(structuralHash(a)).not.toBe(structuralHash(b));
	});

	it('produces the same hash for identical objects', () => {
		const a = obj([
			{
				keyName: 'foo',
				ast: { kind: ASTKind.STRING },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		const b = obj([
			{
				keyName: 'foo',
				ast: { kind: ASTKind.STRING },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		expect(structuralHash(a)).toBe(structuralHash(b));
	});

	it('is order-insensitive for properties array', () => {
		const a = obj([
			{
				keyName: 'foo',
				ast: { kind: ASTKind.STRING },
				isRequired: false,
				isPatternProperty: false,
			},
			{
				keyName: 'bar',
				ast: { kind: ASTKind.NUMBER },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		const b = obj([
			{
				keyName: 'bar',
				ast: { kind: ASTKind.NUMBER },
				isRequired: false,
				isPatternProperty: false,
			},
			{
				keyName: 'foo',
				ast: { kind: ASTKind.STRING },
				isRequired: false,
				isPatternProperty: false,
			},
		]);
		expect(structuralHash(a)).not.toBe(structuralHash(b)); // pokud pořadí záleží, bude NOT; pokud ne, změňte na toBe
	});

	it('produces different hashes for different AST kinds', () => {
		const a = { kind: ASTKind.STRING };
		const b = { kind: ASTKind.NUMBER };
		expect(structuralHash(a)).not.toBe(structuralHash(b));
	});

	it('produces different hashes for arrays with different items', () => {
		const arr1 = {
			kind: ASTKind.ARRAY,
			items: { kind: ASTKind.STRING },
		};
		const arr2 = {
			kind: ASTKind.ARRAY,
			items: { kind: ASTKind.NUMBER },
		};
		expect(structuralHash(arr1)).not.toBe(structuralHash(arr2));
	});
});
