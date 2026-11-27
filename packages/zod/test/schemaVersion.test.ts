import type { JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compileToZod, generateCode, schemaWithExtensions } from './test-utils';

const prefixItemsSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'array',
	prefixItems: [{ type: 'string' }],
	items: { type: 'number' },
} satisfies JSONSchema;

const dependentRequiredSchema = schemaWithExtensions(
	{
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: {
			a: { type: 'string' },
			b: { type: 'string' },
		},
	},
	{ dependentRequired: { a: ['b'] } }
);

const dependentSchemasSchema = schemaWithExtensions(
	{
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: {
			a: { type: 'string' },
			b: { type: 'string' },
		},
	},
	{ dependentSchemas: { a: { required: ['b'] } } }
);

const draft04ExclusiveSchema = schemaWithExtensions(
	{
		$schema: 'http://json-schema.org/draft-04/schema#',
		type: 'number',
		minimum: 0,
	},
	{ exclusiveMinimum: true }
);

const customVersionSchema = {
	$schema: 'https://example.com/custom-meta-schema',
	type: 'string',
} satisfies JSONSchema;

const unsupportedFeatureSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		value: schemaWithExtensions({}, { $dynamicRef: '#meta' }),
	},
} satisfies JSONSchema;

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

	test('unknown $schema falls back to draft-07 by default', async () => {
		await expect(generateCode(customVersionSchema)).resolves.toContain(
			'export const Root = z.string();'
		);
	});

	test('unknown $schema can fail with unknownDialect error', async () => {
		await expect(generateCode(customVersionSchema, { unknownDialect: 'error' })).rejects.toThrow(
			/Unknown dialect/
		);
	});

	test('emits a runtime guard for 2020-12 dynamic references', async () => {
		await expect(generateCode(unsupportedFeatureSchema)).resolves.toContain(
			'createJsonSchemaValidator'
		);
	});

	test('validates recursive dynamic references before decoding', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			$dynamicAnchor: 'node',
			type: 'object',
			properties: {
				value: { type: 'string' },
				next: Object.assign<JSONSchema, { $dynamicRef: string }>({}, { $dynamicRef: '#node' }),
			},
			required: ['value'],
			additionalProperties: false,
		});

		expect(Root.safeParse({ value: 'root', next: { value: 'child' } }).success).toBe(true);
		expect(Root.safeParse({ value: 'root', next: { value: 1 } }).success).toBe(false);
		expect(Root.safeParse({ value: 'root', extra: true }).success).toBe(false);
	});

	test('guard preserves typed additionalProperties decoding', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { id: { type: 'string' } },
			additionalProperties: { type: 'string' },
			unevaluatedProperties: false,
		});

		expect(Root.safeParse({ id: 'x', extra: 'y' })).toMatchObject({
			success: true,
			data: { id: 'x', extra: 'y' },
		});
		expect(Root.safeParse({ id: 'x', extra: 1 }).success).toBe(false);
	});

	test('guard preserves patternProperties decoding', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			patternProperties: { '^S_': { type: 'string' } },
			unevaluatedProperties: false,
		});

		expect(Root.safeParse({ S_name: 'a' })).toMatchObject({
			success: true,
			data: { S_name: 'a' },
		});
		expect(Root.safeParse({ S_name: 1 }).success).toBe(false);
		expect(Root.safeParse({ other: 'a' }).success).toBe(false);
	});

	test('validates unevaluated properties across allOf branches', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2019-09/schema',
			type: 'object',
			properties: { foo: { type: 'string' } },
			allOf: [{ properties: { bar: { type: 'number' } } }],
			unevaluatedProperties: false,
		});

		expect(Root.safeParse({ foo: 'x', bar: 1 }).success).toBe(true);
		expect(Root.safeParse({ foo: 'x', baz: true }).success).toBe(false);
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

	test('unevaluatedProperties maps without $schema', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { a: { type: 'string' } },
			unevaluatedProperties: false,
		});

		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x', b: 1 }).success).toBe(false);
	});

	test('$ref to unevaluatedProperties still resolves', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { a: { $ref: '#/unevaluatedProperties' } },
			unevaluatedProperties: { type: 'string' },
		});

		expect(Root.safeParse({ a: 'x' }).success).toBe(true);
		expect(Root.safeParse({ a: 1 }).success).toBe(false);
		expect(Root.safeParse({ b: 1 }).success).toBe(false);
	});

	test('unevaluatedItems without items allows only empty arrays', async () => {
		const Root = await compileToZod({ type: 'array', unevaluatedItems: false });

		expect(Root.safeParse([]).success).toBe(true);
		expect(Root.safeParse([1]).success).toBe(false);
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
