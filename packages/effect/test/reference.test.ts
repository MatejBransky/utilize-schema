import { describe, expect, test } from 'vitest';

import { compile, compileModule, compileToSchema, decode, type TestSchema, ts } from './test-utils';

describe('references', () => {
	test('emits a definition per referenced schema and suspends every $ref', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				field: { $ref: '#/$defs/MyType' },
				field2: { $ref: '#/$defs/MyType2' },
			},
			$defs: {
				MyType: { type: 'string' },
				MyType2: { type: 'number' },
				MyType3: { type: 'boolean' },
			},
		});

		await expect(result).toMatchCode(ts`
			export const MyType = Schema.String;

			export type MyType = typeof MyType.Type;

			export const MyType2 = Schema.Finite;

			export type MyType2 = typeof MyType2.Type;

			export const MyType3 = Schema.Boolean;

			export type MyType3 = typeof MyType3.Type;

			export const Root = Schema.StructWithRest(
				Schema.Struct({
					field: Schema.optionalKey(Schema.suspend(() => MyType)),
					field2: Schema.optionalKey(Schema.suspend(() => MyType2)),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('$ref used multiple times with an annotation sibling', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				field1: { $ref: '#/$defs/MyType' },
				field2WithDefault: { $ref: '#/$defs/MyType', default: true },
			},
			$defs: { MyType: { type: 'boolean' } },
		});

		await expect(result).toMatchCode(ts`
			export const MyType = Schema.Boolean;

			export type MyType = typeof MyType.Type;

			export const Root = Schema.StructWithRest(
				Schema.Struct({
					field1: Schema.optionalKey(Schema.suspend(() => MyType)),
					field2WithDefault: Schema.optionalKey(
						Schema.suspend(() => MyType).annotate({ default: true })
					),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('external refs', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				name: { type: 'string' },
				dataType: { $ref: './definitions/DataType.json' },
				info: { $ref: './definitions/Info.json' },
				category: { $ref: '#/definitions/Category' },
			},
			definitions: { Category: { type: 'string' } },
		});

		expect(result).toContain('export const DataType');
		expect(result).toContain('export const Info');
		expect(result).toContain('export const OriginalDataType');
		expect(result).toContain('export const Category');
		expect(result).toContain('Schema.suspend(() => DataType)');
	});

	test('parses a tree three levels deep and rejects an invalid node', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: {
				value: { type: 'string' },
				children: { type: 'array', items: { $ref: '#' } },
			},
			required: ['value'],
		});

		expect(
			decode(Root, { value: 'a', children: [{ value: 'b', children: [{ value: 'c' }] }] })
		).toEqual({ value: 'a', children: [{ value: 'b', children: [{ value: 'c' }] }] });
		expect(
			decode(Root, { value: 'a', children: [{ value: 'b', children: [{ value: 1 }] }] })
		).toBeUndefined();
	});

	test('parses nested data across a cyclic pair of files', async () => {
		const module = await compileModule({
			type: 'object',
			properties: { a: { $ref: './definitions/CycleA.json' } },
		});

		expect(decode(module.CycleA!, { b: { a: null } })).toEqual({ b: { a: null } });
		expect(decode(module.CycleA!, { b: { a: { b: { a: null } } } })).toEqual({
			b: { a: { b: { a: null } } },
		});
		expect(decode(module.CycleA!, { b: { a: 1 } })).toBeUndefined();
	});

	test('parses a multi-file tree with nested definitions', async () => {
		const module = await compileModule({
			type: 'object',
			properties: { testArray: { $ref: './definitions/Example.json' } },
		});

		expect(module).toHaveProperty('PropertyA');
		expect(module).toHaveProperty('PropertyB');
	});
});

describe('boolean references', () => {
	test('$ref to true and false schemas', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: {
				allowed: { $ref: '#/definitions/allowed' },
				denied: { $ref: '#/definitions/denied' },
			},
			definitions: {
				allowed: true,
				denied: false,
			},
		} as unknown as TestSchema);

		expect(decode(Root, { allowed: 'anything' })).toEqual({ allowed: 'anything' });
		expect(decode(Root, { denied: 'anything' })).toBeUndefined();
		expect(decode(Root, {})).toEqual({});
	});
});
