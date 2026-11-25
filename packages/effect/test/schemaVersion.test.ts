import { describe, expect, test } from 'vitest';

import { compile, compileToSchema, decode } from './test-utils';
import type { TestSchema } from './test-utils';

const prefixItemsSchema: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'array',
	prefixItems: [{ type: 'string' }],
	items: { type: 'number' },
};

const dependentRequiredSchema: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { a: { type: 'string' }, b: { type: 'string' } },
	dependentRequired: { a: ['b'] },
};

const dependentSchemasSchema: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { a: { type: 'string' }, b: { type: 'string' } },
	dependentSchemas: { a: { required: ['b'] } },
};

const draft04ExclusiveSchema: TestSchema = {
	$schema: 'http://json-schema.org/draft-04/schema#',
	type: 'number',
	minimum: 0,
	// draft-04 uses a boolean flag next to `minimum`.
	exclusiveMinimum: true as unknown as number,
};

const unknownVersionSchema: TestSchema = {
	$schema: 'https://example.com/custom-meta-schema',
	type: 'string',
};

const unsupportedFeatureSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { value: { $dynamicRef: '#meta' } },
} as unknown as TestSchema;

describe('$schema versions', () => {
	test('2020-12 prefixItems and items', async () => {
		const Root = await compileToSchema(prefixItemsSchema);

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1, 2])).toEqual(['a', 1, 2]);
		expect(decode(Root, [1])).toBeUndefined();
		expect(decode(Root, ['a', 'b'])).toBeUndefined();
	});

	test('draft-07 tuple positions are optional and allow a tail by default', async () => {
		const Root = await compileToSchema({
			type: 'array',
			items: [{ type: 'string' }, { type: 'number' }],
		});

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1, true])).toEqual(['a', 1, true]);
		expect(decode(Root, [1])).toBeUndefined();
	});

	test('draft-07 additionalItems false forbids extra items', async () => {
		const Root = await compileToSchema({
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: false,
		});

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1])).toBeUndefined();
	});

	test('2020-12 dependentRequired', async () => {
		const Root = await compileToSchema(dependentRequiredSchema);

		expect(decode(Root, { a: 'x', b: 'y' })).toEqual({ a: 'x', b: 'y' });
		expect(decode(Root, { a: 'x' })).toBeUndefined();
	});

	test('2020-12 dependentSchemas', async () => {
		const Root = await compileToSchema(dependentSchemasSchema);

		expect(decode(Root, { a: 'x', b: 'y' })).toEqual({ a: 'x', b: 'y' });
		expect(decode(Root, { a: 'x' })).toBeUndefined();
	});

	test('draft-04 boolean exclusiveMinimum', async () => {
		const Root = await compileToSchema(draft04ExclusiveSchema);

		expect(decode(Root, 1)).toBe(1);
		expect(decode(Root, 0)).toBeUndefined();
	});

	test('unknown $schema falls back to draft-07 by default', async () => {
		await expect(compile(unknownVersionSchema)).resolves.toContain(
			'export const Root = Schema.String;'
		);
	});

	test('unknown $schema can fail with unknownDialect error', async () => {
		await expect(compile(unknownVersionSchema, { unknownDialect: 'error' })).rejects.toThrow(
			/Unknown dialect/
		);
	});

	test('unsupported 2020-12 features fail loudly', async () => {
		await expect(compile(unsupportedFeatureSchema)).rejects.toThrow(/\$dynamicRef/);
	});

	test('2020-12 unevaluatedProperties maps to additionalProperties', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { a: { type: 'string' } },
			unevaluatedProperties: false,
		});

		expect(decode(Root, { a: 'x' })).toEqual({ a: 'x' });
		expect(decode(Root, { a: 'x', b: 1 })).toBeUndefined();
	});

	test('unevaluatedProperties maps without $schema', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { a: { type: 'string' } },
			unevaluatedProperties: false,
		});

		expect(decode(Root, { a: 'x' })).toEqual({ a: 'x' });
		expect(decode(Root, { a: 'x', b: 1 })).toBeUndefined();
	});

	test('$ref to unevaluatedProperties still resolves', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { a: { $ref: '#/unevaluatedProperties' } },
			unevaluatedProperties: { type: 'string' },
		});

		expect(decode(Root, { a: 'x' })).toEqual({ a: 'x' });
		expect(decode(Root, { a: 1 })).toBeUndefined();
	});

	test('unevaluatedItems without items allows only empty arrays', async () => {
		const Root = await compileToSchema({ type: 'array', unevaluatedItems: false });

		expect(decode(Root, [])).toEqual([]);
		expect(decode(Root, [1])).toBeUndefined();
	});

	test('2020-12 unevaluatedItems maps to the items rest', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }],
			unevaluatedItems: false,
		});

		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1])).toBeUndefined();
	});
});
