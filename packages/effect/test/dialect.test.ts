import { describe, expect, test } from 'vitest';

import { compile, compileToSchema, decode, ts, type TestSchema } from './test-utils';

const draft04 = 'http://json-schema.org/draft-04/schema#';
const draft06 = 'http://json-schema.org/draft-06/schema#';
const draft07 = 'http://json-schema.org/draft-07/schema#';
const twentyTwentyTwelve = 'https://json-schema.org/draft/2020-12/schema';

const refWithSiblings = (dialect: string): TestSchema =>
	({
		$schema: dialect,
		$defs: {
			Base: { type: 'object', properties: { name: { type: 'string' } } },
		},
		type: 'object',
		properties: {
			value: {
				$ref: '#/$defs/Base',
				properties: { extra: { type: 'number' } },
				required: ['extra'],
			},
		},
	}) as unknown as TestSchema;

describe('$ref siblings', () => {
	test('draft-07 ignores them', async () => {
		const Root = await compileToSchema(refWithSiblings(draft07));

		expect(decode(Root, { value: { name: 'x' } })).toEqual({ value: { name: 'x' } });
		expect(decode(Root, { value: { extra: 1 } })).toEqual({ value: { extra: 1 } });
		expect(decode(Root, { value: {} })).toEqual({ value: {} });
	});

	test('2020-12 merges them into the reference', async () => {
		const Root = await compileToSchema(refWithSiblings(twentyTwentyTwelve));

		expect(decode(Root, { value: { name: 'x', extra: 1 } })).toEqual({
			value: { name: 'x', extra: 1 },
		});
		expect(decode(Root, { value: { name: 'x' } })).toBeUndefined();
	});

	test('draft-07 ignores filter siblings', async () => {
		const schema = {
			$schema: draft07,
			$defs: { Name: { type: 'string' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/Name', not: { const: 'x' } } },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, { value: 'x' })).toEqual({ value: 'x' });
	});

	test('2020-12 applies filter siblings on a reference', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			$defs: { Name: { type: 'string' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/Name', not: { const: 'x' } } },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, { value: 'y' })).toEqual({ value: 'y' });
		expect(decode(Root, { value: 'x' })).toBeUndefined();
	});

	test('2020-12 checks siblings of a reference to a non-object schema', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			$defs: { Name: { type: 'string' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/Name', minLength: 3, not: { const: 'abcd' } } },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, { value: 'abc' })).toEqual({ value: 'abc' });
		expect(decode(Root, { value: 'a' })).toBeUndefined();
		expect(decode(Root, { value: 'abcd' })).toBeUndefined();
	});

	test('2020-12 checks siblings of a recursive reference without inlining it', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			$defs: {
				Node: {
					type: 'object',
					properties: {
						next: { $ref: '#/$defs/Node', properties: { tag: { type: 'string' } } },
					},
				},
			},
			$ref: '#/$defs/Node',
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, { next: { tag: 'a', next: {} } })).toEqual({
			next: { tag: 'a', next: {} },
		});
		expect(decode(Root, { next: { tag: 1 } })).toBeUndefined();
	});
});

describe('keywords outside the dialect', () => {
	test('draft-04 ignores const with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft04,
			type: 'string',
			const: 'x',
		} as unknown as TestSchema;

		await expect(compile(schema, { keywordPolicy: 'ignore' })).resolves.toMatchCode(ts`
			export const Root = Schema.String;

			export type Root = typeof Root.Type;
		`);
	});

	test('draft-04 ignores contains with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft04,
			type: 'array',
			contains: { enum: [{ id: 1 }] },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema, { keywordPolicy: 'ignore' });

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, ['a'])).toEqual(['a']);
	});

	test('draft-06 ignores if/then with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft06,
			type: 'string',
			if: { pattern: '^a' },
			then: { minLength: 2 },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema, { keywordPolicy: 'ignore' });

		expect(decode(Root, 'a')).toBe('a');
	});

	test('draft-07 applies if/then', async () => {
		const schema = {
			$schema: draft07,
			type: 'string',
			if: { pattern: '^a' },
			then: { minLength: 2 },
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, 'ab')).toBe('ab');
		expect(decode(Root, 'a')).toBeUndefined();
	});

	test('draft-07 ignores prefixItems with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft07,
			type: 'array',
			prefixItems: [{ type: 'string' }],
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema, { keywordPolicy: 'ignore' });

		expect(decode(Root, [1, 2])).toEqual([1, 2]);
	});

	test('2020-12 ignores the removed tuple form of items with keywordPolicy ignore', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'array',
			items: [{ type: 'string' }],
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema, { keywordPolicy: 'ignore' });

		expect(decode(Root, [1, 2])).toEqual([1, 2]);
	});

	test('draft-07 ignores unevaluatedProperties with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft07,
			type: 'object',
			properties: { a: { type: 'string' } },
			unevaluatedProperties: false,
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema, { keywordPolicy: 'ignore' });

		expect(decode(Root, { a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
	});

	test('draft-07 uses the tuple form of items', async () => {
		const schema = {
			$schema: draft07,
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: false,
		} as unknown as TestSchema;

		const Root = await compileToSchema(schema);

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1])).toBeUndefined();
	});
});
