import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod } from './test-utils';

const prefixItemsSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'array',
	prefixItems: [{ type: 'string' }],
	items: { type: 'number' },
} as unknown as JSONSchema;

const dependentRequiredSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		a: { type: 'string' },
		b: { type: 'string' },
	},
	dependentRequired: { a: ['b'] },
} as unknown as JSONSchema;

const dependentSchemasSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		a: { type: 'string' },
		b: { type: 'string' },
	},
	dependentSchemas: { a: { required: ['b'] } },
} as unknown as JSONSchema;

const draft04ExclusiveSchema = {
	$schema: 'http://json-schema.org/draft-04/schema#',
	type: 'number',
	minimum: 0,
	exclusiveMinimum: true,
} as unknown as JSONSchema;

const customVersionSchema = {
	$schema: 'https://example.com/custom-meta-schema',
	type: 'string',
} as unknown as JSONSchema;

const unsupportedFeatureSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { value: { $dynamicRef: '#meta' } },
} as unknown as JSONSchema;

describe('$schema versions', () => {
	test('2020-12 prefixItems and items', async () => {
		const Root = await compileToZod(prefixItemsSchema);

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse(['a']).success).toBe(true);
		expect(Root.safeParse(['a', 1]).success).toBe(true);
		expect(Root.safeParse(['a', 1, 2]).success).toBe(true);
		expect(Root.safeParse([1]).success).toBe(false);
		expect(Root.safeParse(['a', 'b']).success).toBe(false);
	});

	test('draft-07 tuple positions are optional and allow a tail by default', async () => {
		const Root = await compileToZod({
			type: 'array',
			items: [{ type: 'string' }, { type: 'number' }],
		});

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse(['a']).success).toBe(true);
		expect(Root.safeParse(['a', 1, true]).success).toBe(true);
		expect(Root.safeParse([1]).success).toBe(false);
	});

	test('draft-07 additionalItems false forbids extra items', async () => {
		const Root = await compileToZod({
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: false,
		});

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse(['a']).success).toBe(true);
		expect(Root.safeParse(['a', 1]).success).toBe(false);
	});

	test('2020-12 dependentRequired', async () => {
		const Root = await compileToZod(dependentRequiredSchema);

		expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x' }).success).toBe(false);
	});

	test('2020-12 dependentSchemas', async () => {
		const Root = await compileToZod(dependentSchemasSchema);

		expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x' }).success).toBe(false);
	});

	test('draft-04 boolean exclusiveMinimum', async () => {
		const Root = await compileToZod(draft04ExclusiveSchema);

		expect(Root.safeParse(1).success).toBe(true);
		expect(Root.safeParse(0).success).toBe(false);
	});

	test('unknown $schema falls back to draft-07', async () => {
		const Root = await compileToZod(customVersionSchema);

		expect(Root.safeParse('value').success).toBe(true);
		expect(Root.safeParse(1).success).toBe(false);
	});

	test('unsupported 2020-12 features fail loudly', async () => {
		await expect(compile(unsupportedFeatureSchema)).rejects.toThrow(
			/"\$dynamicRef" is not supported/
		);
	});

	test('2020-12 unevaluatedProperties maps to additionalProperties', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { a: { type: 'string' } },
			unevaluatedProperties: false,
		});

		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x', b: 1 }).success).toBe(false);
	});

	test('2020-12 unevaluatedItems maps to the items rest', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }],
			unevaluatedItems: false,
		});

		expect(Root.safeParse(['a']).success).toBe(true);
		expect(Root.safeParse(['a', 1]).success).toBe(false);
	});
});
