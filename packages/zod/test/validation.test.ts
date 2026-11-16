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

const propertyNamesSchema: JSONSchema = {
	type: 'object',
	additionalProperties: true,
	propertyNames: { pattern: '^[a-z]+$' },
};
