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

	test('validates patternProperties and lets unmatched keys use additionalProperties', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { id: { type: 'string' } },
			patternProperties: {
				'^S_': { type: 'string' },
				'^I_': { type: 'integer' },
			},
			additionalProperties: { type: 'boolean' },
		});

		expect(Root.safeParse({ id: 'x', S_name: 'a', I_count: 2, flag: true }).success).toBe(true);
		expect(Root.safeParse({ S_name: 1 }).success).toBe(false);
		expect(Root.safeParse({ I_count: 'a' }).success).toBe(false);
		expect(Root.safeParse({ other: 'a' }).success).toBe(false);
	});

	test('rejects unmatched keys when patternProperties closes the object', async () => {
		const Root = await compileToZod({
			type: 'object',
			patternProperties: { '^S_': { type: 'string' } },
			additionalProperties: false,
		});

		expect(Root.safeParse({ S_name: 'a' }).success).toBe(true);
		expect(Root.safeParse({ other: 'a' }).success).toBe(false);
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

describe('literal values', () => {
	test('compares const and enum values by deep equality', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				config: { const: { a: 1, b: [true, null] } },
				mode: { enum: [{ kind: 'x' }, [1, 2], 'plain'] },
			},
		});

		expect(Root.safeParse({ config: { b: [true, null], a: 1 } }).success).toBe(true);
		expect(Root.safeParse({ config: { a: 1, b: [true, null], extra: 1 } }).success).toBe(false);
		expect(Root.safeParse({ config: { a: 1, b: [true, 0] } }).success).toBe(false);

		expect(Root.safeParse({ mode: { kind: 'x' } }).success).toBe(true);
		expect(Root.safeParse({ mode: { kind: 'x', extra: 1 } }).success).toBe(false);
		expect(Root.safeParse({ mode: [1, 2] }).success).toBe(true);
		expect(Root.safeParse({ mode: [1, 2, 3] }).success).toBe(false);
		expect(Root.safeParse({ mode: 'plain' }).success).toBe(true);
	});

	test('requires exactly one oneOf branch to match', async () => {
		const Root = await compileToZod({
			type: 'number',
			oneOf: [{ multipleOf: 2 }, { multipleOf: 3 }],
		});

		expect(Root.safeParse(2).success).toBe(true);
		expect(Root.safeParse(3).success).toBe(true);
		expect(Root.safeParse(6).success).toBe(false);
		expect(Root.safeParse(5).success).toBe(false);
	});
});

describe('sibling constraints on literals', () => {
	test('combines const and enum with their siblings', async () => {
		const Const = await compileToZod({ const: 'ok', minLength: 3 });
		expect(Const.safeParse('ok').success).toBe(false);
		expect(Const.safeParse('long').success).toBe(false);

		const Enum = await compileToZod({ type: 'string', enum: ['ok', { a: 1 }] });
		expect(Enum.safeParse('ok').success).toBe(true);
		expect(Enum.safeParse({ a: 1 }).success).toBe(false);
		expect(Enum.safeParse('other').success).toBe(false);

		const ObjectEnum = await compileToZod({
			type: 'object',
			properties: { a: {} },
			enum: [{ a: 'x' }, { a: 1 }],
		});
		expect(ObjectEnum.safeParse({ a: 'x' }).success).toBe(true);
		expect(ObjectEnum.safeParse({ a: 1 }).success).toBe(true);
		expect(ObjectEnum.safeParse({ a: 2 }).success).toBe(false);
		expect(ObjectEnum.safeParse({ b: 1 }).success).toBe(false);
	});

	test('counts oneOf matches on the original input', async () => {
		const Root = await compileToZod({
			oneOf: [
				{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
				{ type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
			],
		});

		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
		expect(Root.safeParse({ b: 1 }).success).toBe(true);
		expect(Root.safeParse({ a: 'x', b: 1 }).success).toBe(false);
	});
});

describe('a __proto__ property', () => {
	test('is validated and required', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { ['__proto__']: { type: 'number' } },
			required: ['__proto__'],
		});

		expect(Root.safeParse(JSON.parse('{ "__proto__": 12 }')).success).toBe(true);
		expect(Root.safeParse(JSON.parse('{ "__proto__": "text" }')).success).toBe(false);
		expect(Root.safeParse({}).success).toBe(false);
	});

	test('is validated but may be omitted when optional', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { ['__proto__']: { type: 'number' } },
		});

		expect(Root.safeParse({}).success).toBe(true);
		expect(Root.safeParse(JSON.parse('{ "__proto__": 12 }')).success).toBe(true);
		expect(Root.safeParse(JSON.parse('{ "__proto__": "text" }')).success).toBe(false);
	});

	test('is required when it has no properties entry', async () => {
		const Root = await compileToZod({ type: 'object', required: ['__proto__'] });

		expect(Root.safeParse(JSON.parse('{ "__proto__": 12 }')).success).toBe(true);
		expect(Root.safeParse({}).success).toBe(false);
	});

	test('is validated when it comes from allOf', async () => {
		const Root = await compileToZod({
			type: 'object',
			allOf: [
				{ type: 'object', properties: { ['__proto__']: { type: 'number' } } },
				{ type: 'object', properties: { b: { type: 'string' } } },
			],
		});

		expect(Root.safeParse(JSON.parse('{ "__proto__": 12 }')).success).toBe(true);
		expect(Root.safeParse({ b: 'x' }).success).toBe(true);
		expect(Root.safeParse(JSON.parse('{ "__proto__": "text" }')).success).toBe(false);
		expect(Root.safeParse({ b: 1 }).success).toBe(false);
	});
});
