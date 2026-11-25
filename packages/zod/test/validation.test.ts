import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod, ts } from './test-utils';

describe('validation keywords', () => {
	test('not', async () => {
		const Root = await compileToZod({
			type: 'string',
			not: { const: 'forbidden' },
		});

		expect(Root.safeParse('ok').success).toBe(true);
		expect(Root.safeParse('forbidden').success).toBe(false);
	});

	test('if / then / else', async () => {
		const Root = await compileToZod(ifThenElseSchema);

		expect(Root.safeParse({ country: 'US', postal: '12345' }).success).toBe(true);
		expect(Root.safeParse({ country: 'US', postal: 'abc' }).success).toBe(false);
		expect(Root.safeParse({ country: 'CA', postal: 'abc' }).success).toBe(true);
		expect(Root.safeParse({ country: 'CA', postal: 'ab' }).success).toBe(false);
	});

	test('contains', async () => {
		const Root = await compileToZod({
			type: 'array',
			contains: { type: 'number' },
		});

		expect(Root.safeParse([1, 'a']).success).toBe(true);
		expect(Root.safeParse(['a', 'b']).success).toBe(false);
	});

	test('keeps the single-match message for a plain contains', async () => {
		const Root = await compileToZod({ type: 'array', contains: { const: 'x' } });
		const result = Root.safeParse(['a']);

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe(
			'Array must contain an item matching the "contains" schema.'
		);
	});

	test('minContains and maxContains', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			items: { type: 'string' },
			contains: { const: 'x' },
			minContains: 2,
			maxContains: 3,
		});

		expect(Root.safeParse(['x', 'x']).success).toBe(true);
		expect(Root.safeParse(['a', 'x', 'x']).success).toBe(true);
		expect(Root.safeParse(['x']).success).toBe(false);
		expect(Root.safeParse(['x', 'x', 'x', 'x']).success).toBe(false);
	});

	test('minContains 0 allows no match', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			contains: { const: 'x' },
			minContains: 0,
		});

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse(['a']).success).toBe(true);
	});

	test('pattern uses unicode mode', async () => {
		const Root = await compileToZod({ type: 'string', pattern: '^\\p{Letter}+$' });

		expect(Root.safeParse('π').success).toBe(true);
		expect(Root.safeParse('123').success).toBe(false);
	});

	test('propertyNames', async () => {
		const Root = await compileToZod(propertyNamesSchema);

		expect(Root.safeParse({ abc: 1 }).success).toBe(true);
		expect(Root.safeParse({ Abc: 1 }).success).toBe(false);
	});

	test('dependencies with required properties', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				a: { type: 'string' },
				b: { type: 'string' },
			},
			dependencies: { a: ['b'] },
		});

		expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x' }).success).toBe(false);
		expect(Root.safeParse({ b: 'y' }).success).toBe(true);
	});

	test('dependencies with a schema', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				a: { type: 'string' },
				b: { type: 'string' },
			},
			dependencies: { a: { required: ['b'] } },
		});

		expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x' }).success).toBe(false);
	});

	test('emits each refinement once in keyword order', async () => {
		const result = await compile({
			$schema: 'http://json-schema.org/draft-07/schema#',
			properties: { a: { type: 'string' } },
			required: ['a'],
			not: { required: ['b'] },
			if: { required: ['a'] },
			then: { required: ['b'] },
			contains: { type: 'number' },
			uniqueItems: true,
			minProperties: 1,
			maxProperties: 2,
			propertyNames: { pattern: '^[a-z]+$' },
			dependencies: { a: ['b'] },
		});
		const markers = [
			"if (typeof value === 'object'",
			'const result = z.array(z.unknown()).safeParse(value);',
			'Value must not match the "not" schema.',
			'safeParse(value).success',
			'Array must contain an item matching the "contains" schema.',
			'Array items must be unique.',
			'Object must have at least 1 properties.',
			'Object must have at most 2 properties.',
			'for (const key of Object.keys(value))',
			'Required dependency is missing.',
		];
		const normalized = result.replace(/\s+/g, ' ');
		const positions = markers.map((marker) => {
			const position = normalized.indexOf(marker);

			expect(position, marker).toBeGreaterThanOrEqual(0);
			return position;
		});

		expect(
			positions.every((position, index) => index === 0 || positions[index - 1]! <= position)
		).toBe(true);
		expect(result.split('Array items must be unique.')).toHaveLength(2);
		expect(result.split('Object must have at least 1 properties.')).toHaveLength(2);
		expect(result.split('Object must have at most 2 properties.')).toHaveLength(2);
	});

	test('refs inside validation keywords are collected', async () => {
		const Root = await compileToZod({
			type: 'object',
			additionalProperties: true,
			propertyNames: { $ref: '#/$defs/Name' },
			$defs: {
				Name: { type: 'string', pattern: '^[a-z]+$' },
			},
		});

		expect(Root.safeParse({ abc: 1 }).success).toBe(true);
		expect(Root.safeParse({ Abc: 1 }).success).toBe(false);
	});

	test('examples are added as metadata', async () => {
		const result = await compile({
			type: 'string',
			examples: ['a', 'b'],
		});

		await expect(result).toMatchCode(ts`
      export const Root = z.string().meta({ examples: ['a', 'b'] });
      export type Root = z.infer<typeof Root>;
    `);
	});
});

const ifThenElseSchema: JSONSchema = {
	type: 'object',
	properties: {
		country: { type: 'string' },
		postal: { type: 'string' },
	},
	required: ['country'],
	if: {
		properties: { country: { const: 'US' } },
		required: ['country'],
	},
	then: {
		properties: { postal: { pattern: '^[0-9]{5}$' } },
		required: ['postal'],
	},
	else: {
		properties: { postal: { minLength: 3 } },
	},
};

describe('array and object size keywords', () => {
	test('uniqueItems', async () => {
		const Root = await compileToZod({
			type: 'array',
			items: { type: 'number' },
			uniqueItems: true,
		});

		expect(Root.safeParse([1, 2]).success).toBe(true);
		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse([1, 1]).success).toBe(false);
	});

	test('uniqueItems compares objects regardless of key order', async () => {
		const Root = await compileToZod({
			type: 'array',
			items: { type: 'object' },
			uniqueItems: true,
		});

		expect(
			Root.safeParse([
				{ a: 1, b: 2 },
				{ b: 2, a: 1 },
			]).success
		).toBe(false);
		expect(Root.safeParse([{ a: 1 }, { a: 2 }]).success).toBe(true);
	});

	test('uniqueItems false keeps duplicates', async () => {
		const Root = await compileToZod({ type: 'array', uniqueItems: false });

		expect(Root.safeParse([1, 1]).success).toBe(true);
	});

	test('minProperties counts undeclared keys too', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { a: { type: 'string' } },
			minProperties: 1,
		});

		expect(Root.safeParse({}).success).toBe(false);
		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
		expect(Root.safeParse({ b: 1 }).success).toBe(true);
	});

	test('maxProperties', async () => {
		const Root = await compileToZod({ type: 'object', maxProperties: 1 });

		expect(Root.safeParse({ a: 1 }).success).toBe(true);
		expect(Root.safeParse({ a: 1, b: 2 }).success).toBe(false);
	});
});

const propertyNamesSchema: JSONSchema = {
	type: 'object',
	additionalProperties: true,
	propertyNames: { pattern: '^[a-z]+$' },
};
