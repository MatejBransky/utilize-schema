import { describe, expect, test } from 'vitest';

import { expectDefined } from '@utilize/json-schema';
import type { JSONSchema } from '@utilize/json-schema';

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
};
// draft-04 uses a boolean flag next to `minimum`.
Object.assign(draft04ExclusiveSchema, { exclusiveMinimum: true });

const unknownVersionSchema: TestSchema = {
	$schema: 'https://example.com/custom-meta-schema',
	type: 'string',
};

const unsupportedFeatureSchema: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { value: {} },
};
Object.assign(expectDefined(unsupportedFeatureSchema.properties?.value), {
	$dynamicRef: '#meta',
});

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

	test('2019-09 dependentRequired constrains only objects without an explicit type', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2019-09/schema',
			dependentRequired: { bar: ['foo'] },
		});

		expect(decode(Root, { foo: 1, bar: 2 })).toEqual({ foo: 1, bar: 2 });
		expect(decode(Root, { bar: 2 })).toBeUndefined();
		expect(decode(Root, ['bar'])).toEqual(['bar']);
	});

	test('2020-12 dependentSchemas constrains only objects without an explicit type', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			dependentSchemas: { bar: false },
		});

		expect(decode(Root, { foo: 1 })).toEqual({ foo: 1 });
		expect(decode(Root, { bar: 2 })).toBeUndefined();
		expect(decode(Root, 'bar')).toBe('bar');
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

	test('emits a runtime guard for 2020-12 dynamic references', async () => {
		await expect(compile(unsupportedFeatureSchema)).resolves.toContain('createJsonSchemaValidator');
	});

	test('validates recursive dynamic references before decoding', async () => {
		const Root = await compileToSchema({
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

		expect(decode(Root, { value: 'root', next: { value: 'child' } })).toEqual({
			value: 'root',
			next: { value: 'child' },
		});
		expect(decode(Root, { value: 'root', next: { value: 1 } })).toBeUndefined();
		expect(decode(Root, { value: 'root', extra: true })).toBeUndefined();
	});

	test('validates unevaluated properties across allOf branches', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2019-09/schema',
			type: 'object',
			properties: { foo: { type: 'string' } },
			allOf: [{ properties: { bar: { type: 'number' } } }],
			unevaluatedProperties: false,
		});

		expect(decode(Root, { foo: 'x', bar: 1 })).toEqual({ foo: 'x', bar: 1 });
		expect(decode(Root, { foo: 'x', baz: true })).toBeUndefined();
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
