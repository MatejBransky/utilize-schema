import { describe, expect, test } from 'vitest';

import { generate } from '../src';

import { compile, compileModule, compileToSchema, decode, ts } from './test-utils';

describe('regressions', () => {
	test('boolean false schemas reject all values', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { forbidden: false, allowed: true },
			required: ['allowed'],
		});

		expect(decode(Root, { allowed: 'anything' })).toEqual({ allowed: 'anything' });
		expect(decode(Root, { allowed: 1, forbidden: null })).toBeUndefined();
	});

	test('boolean false root generates never', () => {
		expect(generate(false, { importEffect: false })).toBe(
			'export const Root = Schema.Never;\n\nexport type Root = typeof Root.Type;\n'
		);
	});

	test('required keys without a properties entry use additionalProperties', async () => {
		const Root = await compileToSchema({
			type: 'object',
			required: ['value'],
			additionalProperties: { type: 'number' },
		});

		expect(decode(Root, { value: 1 })).toEqual({ value: 1 });
		expect(decode(Root, { value: 'one' })).toBeUndefined();
	});

	test('required keys are unsatisfiable when additional properties are forbidden', async () => {
		const Root = await compileToSchema({
			type: 'object',
			required: ['value'],
			additionalProperties: false,
		});

		expect(decode(Root, {})).toBeUndefined();
		expect(decode(Root, { value: 1 })).toBeUndefined();
	});

	test('quotes required keys that are not valid identifiers', async () => {
		const result = await compile({ type: 'object', required: ['not-an-identifier'] });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(
				Schema.Struct({ 'not-an-identifier': Schema.Json }),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('rejects minContains and maxContains instead of ignoring them', async () => {
		await expect(
			compile({
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'array',
				items: { type: 'string' },
				contains: { const: 'x' },
				minContains: 1,
			})
		).rejects.toThrow(/minContains/);
		await expect(
			compile({
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'array',
				items: { type: 'string' },
				contains: { const: 'x' },
				maxContains: 2,
			})
		).rejects.toThrow(/maxContains/);
	});

	test('combines dependentRequired and dependentSchemas for the same key', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: { a: { type: 'string' }, b: { type: 'string' } },
			dependentRequired: { a: ['b'] },
			dependentSchemas: { a: { properties: { b: { minLength: 2 } } } },
		});

		expect(decode(Root, { a: 'x', b: 'yy' })).toEqual({ a: 'x', b: 'yy' });
		expect(decode(Root, { a: 'x' })).toBeUndefined();
		expect(decode(Root, { a: 'x', b: 'y' })).toBeUndefined();
	});

	test('keyword-only schemas do not reject other types', async () => {
		const Root = await compileToSchema({ minLength: 2 });

		expect(decode(Root, 'ab')).toBe('ab');
		expect(decode(Root, 'a')).toBeUndefined();
		expect(decode(Root, 1)).toBe(1);
	});

	test('not narrows a keyword-only subschema to the parent type', async () => {
		const Root = await compileToSchema({ type: 'string', not: { minLength: 2 } });

		expect(decode(Root, 'a')).toBe('a');
		expect(decode(Root, 'ab')).toBeUndefined();
	});

	test('$refs into prefixItems survive schema normalization', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ $ref: '#/$defs/Name' }, { type: 'number' }],
			items: false,
			$defs: { Name: { type: 'string' } },
		});

		expect(decode(Root, ['a', 1])).toEqual(['a', 1]);
		expect(decode(Root, [1, 1])).toBeUndefined();
	});

	test('propertyNames sees keys before the object strips them', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { known: { type: 'string' } },
			propertyNames: { pattern: '^[a-z]+$' },
		});

		expect(decode(Root, { known: 'x', extra: 1 })).toEqual({ known: 'x', extra: 1 });
		expect(decode(Root, { known: 'x', Extra: 1 })).toBeUndefined();
	});

	test('dependencies sees undeclared keys before the object strips them', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { a: { type: 'string' } },
			dependencies: { a: ['b'] },
		});

		expect(decode(Root, { a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
		expect(decode(Root, { a: 'x' })).toBeUndefined();
	});

	test('keeps a recursive $ref inside an anyOf', async () => {
		const module = await compileModule({
			type: 'object',
			properties: {
				parent: { anyOf: [{ $ref: '#' }, { type: 'null' }] },
			},
		});

		expect(decode(module.Root!, { parent: null })).toEqual({ parent: null });
		expect(decode(module.Root!, { parent: { parent: null } })).toEqual({
			parent: { parent: null },
		});
		expect(decode(module.Root!, { parent: 1 })).toBeUndefined();
	});
});
