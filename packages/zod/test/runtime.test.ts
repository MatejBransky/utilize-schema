import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compileModule, compileToZod } from './test-utils';

describe('generated schemas at runtime', () => {
	test('parses nested data through a typed getter tree', async () => {
		const module = await compileModule(makeTreeSchema({ title: 'Tree' }));
		const Tree = module.Tree!;

		expect(
			Tree.safeParse({
				name: 'root',
				children: [{ name: 'child', children: [{ name: 'leaf' }] }],
			}).success
		).toBe(true);
		expect(Tree.safeParse({ name: 'root', children: [{ children: [] }] }).success).toBe(false);
		expect(
			Tree.safeParse({
				name: 'root',
				children: [{ name: 'child', children: [{ name: 42 }] }],
			}).success
		).toBe(false);
	});

	test('keeps schemas with the same title separate at runtime', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				tree: { $ref: '#/$defs/Tree' },
				tree1: { $ref: '#/$defs/Tree1' },
			},
			required: ['tree', 'tree1'],
			$defs: {
				Tree: makeTreeSchema({ title: 'Tree', childRef: '#/$defs/Tree' }),
				Tree1: makeTreeSchema({ title: 'Tree', childRef: '#/$defs/Tree' }),
			},
		});

		expect(
			Root.safeParse({
				tree: { name: 'a', children: [{ name: 'b' }] },
				tree1: { name: 'c', children: [{ name: 'd' }] },
			}).success
		).toBe(true);
		expect(
			Root.safeParse({
				tree: { name: 'a', children: [{ name: 42 }] },
				tree1: { name: 'c' },
			}).success
		).toBe(false);
	});

	test('parses an allOf intersection of refs, objects and defaults', async () => {
		const Root = await compileToZod({
			allOf: [
				{ $ref: '#/$defs/Named' },
				{
					type: 'object',
					properties: { age: { type: 'number' } },
					required: ['age'],
				},
				{
					type: 'object',
					properties: { active: { type: 'boolean', default: true } },
				},
				{
					type: 'object',
					properties: { role: { enum: ['admin', 'user'] } },
					required: ['role'],
				},
			],
			$defs: {
				Named: {
					type: 'object',
					properties: { name: { type: 'string' } },
					required: ['name'],
				},
			},
		});

		const result = Root.safeParse({ name: 'Ada', age: 36, role: 'admin' });

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ name: 'Ada', age: 36, role: 'admin', active: true });
		expect(Root.safeParse({ name: 'Ada', age: '36', role: 'admin' }).success).toBe(false);
		expect(Root.safeParse({ name: 'Ada', age: 36, role: 'owner' }).success).toBe(false);
	});

	test('requires object keys that are not declared in properties', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name', 'extra'],
		});

		expect(Root.safeParse({ name: 'x', extra: 1 }).success).toBe(true);
		expect(Root.safeParse({ name: 'x' }).success).toBe(false);
	});

	test('parses recursive records', async () => {
		const Root = await compileToZod({
			type: 'object',
			additionalProperties: { $ref: '#' },
		});

		expect(Root.safeParse({ a: { b: { c: {} } } }).success).toBe(true);
		expect(Root.safeParse({ a: { b: 'not an object' } }).success).toBe(false);
	});

	test('applies defaults on referenced schemas', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { enabled: { $ref: '#/$defs/Flag', default: true } },
			$defs: { Flag: { type: 'boolean' } },
		});

		expect(Root.parse({})).toEqual({ enabled: true });
		expect(Root.safeParse({ enabled: false }).success).toBe(true);
	});
});

function makeTreeSchema(options: { title?: string; childRef?: string } = {}): JSONSchema {
	return {
		...(options.title ? { title: options.title } : {}),
		type: 'object',
		properties: {
			name: { type: 'string' },
			children: {
				type: 'array',
				items: { $ref: options.childRef ?? '#' },
			},
		},
		required: ['name'],
	};
}
