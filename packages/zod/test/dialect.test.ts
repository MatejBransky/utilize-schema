import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod } from './test-utils';

const draft04 = 'http://json-schema.org/draft-04/schema#';
const draft06 = 'http://json-schema.org/draft-06/schema#';
const draft07 = 'http://json-schema.org/draft-07/schema#';
const twentyTwentyTwelve = 'https://json-schema.org/draft/2020-12/schema';

const refWithSiblings = (dialect: string) =>
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
	}) as unknown as JSONSchema;

describe('$ref siblings', () => {
	test('draft-07 ignores them', async () => {
		const Root = await compileToZod(refWithSiblings(draft07));

		expect(Root.safeParse({ value: { name: 'x' } }).success).toBe(true);
		expect(Root.safeParse({ value: { extra: 1 } }).success).toBe(true);
		expect(Root.safeParse({ value: {} }).success).toBe(true);
	});

	test('2020-12 intersects them with the reference', async () => {
		const Root = await compileToZod(refWithSiblings(twentyTwentyTwelve));

		expect(Root.safeParse({ value: { name: 'x', extra: 1 } }).success).toBe(true);
		expect(Root.safeParse({ value: { extra: 1 } }).success).toBe(true);
		expect(Root.safeParse({ value: { name: 'x' } }).success).toBe(false);
	});

	test('draft-07 ignores refinement siblings', async () => {
		const schema = {
			$schema: draft07,
			$defs: { Name: { type: 'string' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/Name', minLength: 3 } },
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse({ value: 'a' }).success).toBe(true);
	});

	test('2020-12 applies refinement siblings', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			$defs: { Name: { type: 'string' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/Name', minLength: 3 } },
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse({ value: 'abc' }).success).toBe(true);
		expect(Root.safeParse({ value: 'a' }).success).toBe(false);
	});

	test('draft-07 ignores filter siblings', async () => {
		const schema = {
			$schema: draft07,
			$defs: { Name: { type: 'string' }, List: { type: 'array' } },
			type: 'object',
			properties: {
				name: { $ref: '#/$defs/Name', not: { const: 'x' } },
				list: { $ref: '#/$defs/List', uniqueItems: true },
			},
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse({ name: 'x', list: [1, 1] }).success).toBe(true);
	});

	test('2020-12 applies filter siblings', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			$defs: { Name: { type: 'string' }, List: { type: 'array' } },
			type: 'object',
			properties: {
				name: { $ref: '#/$defs/Name', not: { const: 'x' } },
				list: { $ref: '#/$defs/List', uniqueItems: true },
			},
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse({ name: 'y', list: [1, 2] }).success).toBe(true);
		expect(Root.safeParse({ name: 'x' }).success).toBe(false);
		expect(Root.safeParse({ list: [1, 1] }).success).toBe(false);
	});

	test('value types keep the dialect of an embedded resource', async () => {
		const schema = {
			$schema: draft07,
			definitions: {
				List: {
					$schema: twentyTwentyTwelve,
					type: 'array',
					items: {
						$ref: '#/definitions/List',
						type: 'array',
						prefixItems: [{ type: 'string' }],
					},
				},
			},
			$ref: '#/definitions/List',
		} as unknown as JSONSchema;

		// The root keeps a `Root` alias to the referenced resource, whose dialect
		// still decides how its items are generated.
		await expect(compile(schema)).resolves.toContain(
			'type ListValue = (ListValue & [string?, ...unknown[]])[];'
		);
		await expect(compile(schema)).resolves.toContain('export const Root = List;');
	});

	test('2020-12 generates an intersection', async () => {
		await expect(compile(refWithSiblings(twentyTwentyTwelve))).resolves.toContain('.intersection(');
		await expect(compile(refWithSiblings(draft07))).resolves.not.toContain('.intersection(');
	});
});

describe('keywords outside the dialect', () => {
	test('draft-04 ignores const with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft04,
			type: 'string',
			const: 'x',
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema, { keywordPolicy: 'ignore' });

		expect(Root.safeParse('y').success).toBe(true);
		expect(Root.safeParse(1).success).toBe(false);
	});

	test('draft-06 ignores if/then with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft06,
			type: 'string',
			if: { pattern: '^a' },
			then: { minLength: 2 },
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema, { keywordPolicy: 'ignore' });

		expect(Root.safeParse('a').success).toBe(true);
	});

	test('draft-07 applies if/then', async () => {
		const schema = {
			$schema: draft07,
			type: 'string',
			if: { pattern: '^a' },
			then: { minLength: 2 },
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse('ab').success).toBe(true);
		expect(Root.safeParse('a').success).toBe(false);
	});

	test('draft-07 ignores prefixItems with keywordPolicy ignore', async () => {
		const schema = {
			$schema: draft07,
			type: 'array',
			prefixItems: [{ type: 'string' }],
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema, { keywordPolicy: 'ignore' });

		expect(Root.safeParse([1, 2]).success).toBe(true);
	});

	test('2020-12 ignores the removed tuple form of items with keywordPolicy ignore', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'array',
			items: [{ type: 'string' }],
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema, { keywordPolicy: 'ignore' });

		expect(Root.safeParse([1, 2]).success).toBe(true);
	});

	test('2020-12 ignores a leftover dependencies keyword with keywordPolicy ignore', async () => {
		const schema = {
			$schema: twentyTwentyTwelve,
			type: 'object',
			properties: { a: { type: 'string' }, b: { type: 'string' } },
			dependencies: { a: ['b'] },
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema, { keywordPolicy: 'ignore' });

		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
	});

	test('draft-07 uses the tuple form of items', async () => {
		const schema = {
			$schema: draft07,
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: false,
		} as unknown as JSONSchema;

		const Root = await compileToZod(schema);

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse(['a']).success).toBe(true);
		expect(Root.safeParse(['a', 1]).success).toBe(false);
	});
});
