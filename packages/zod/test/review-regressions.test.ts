import type { JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod } from './test-utils';

describe('review regressions', () => {
	test('boolean false schemas reject all values', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { forbidden: false },
		});

		expect(Root.safeParse({}).success).toBe(true);
		expect(Root.safeParse({ forbidden: 1 }).success).toBe(false);
	});

	test('conditionals keep boolean subschemas', async () => {
		const Root = await compileToZod({
			type: 'string',
			if: true,
			then: false,
		});

		expect(Root.safeParse('value').success).toBe(false);
	});

	test('required keys use the additionalProperties schema', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {},
			required: ['extra'],
			additionalProperties: { type: 'number' },
		});

		expect(Root.safeParse({ extra: 1 }).success).toBe(true);
		expect(Root.safeParse({ extra: 'wrong' }).success).toBe(false);
		expect(Root.safeParse({}).success).toBe(false);
	});

	test('required keys are unsatisfiable when additional properties are forbidden', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {},
			required: ['extra'],
			additionalProperties: false,
		});

		expect(Root.safeParse({ extra: 1 }).success).toBe(false);
		expect(Root.safeParse({}).success).toBe(false);
	});

	test('quotes required keys that are not valid identifiers', async () => {
		const result = await compile({
			type: 'object',
			properties: {},
			required: ['order-id'],
		});

		expect(result).toContain("'order-id'");
	});

	test('normalization does not treat property names as schemas', async () => {
		const schema = {
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: {
				unevaluatedProperties: { type: 'string' },
				$recursiveRef: { type: 'number' },
			},
		} as unknown as JSONSchema;

		await expect(compile(schema)).resolves.toContain('export const Root');
	});

	test('combines dependentRequired and dependentSchemas for the same key', async () => {
		const Root = await compileToZod({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'object',
			properties: {
				a: { type: 'string' },
				b: { type: 'string' },
				c: { type: 'string' },
			},
			dependentRequired: { a: ['b'] },
			dependentSchemas: { a: { required: ['c'] } },
		} as unknown as JSONSchema);

		expect(Root.safeParse({ a: 'x', b: 'y', c: 'z' }).success).toBe(true);
		expect(Root.safeParse({ a: 'x', c: 'z' }).success).toBe(false);
		expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(false);
		expect(Root.safeParse({ b: 'y', c: 'z' }).success).toBe(true);
	});
});

test('keyword-only schemas do not reject other types', async () => {
	const Root = await compileToZod({ pattern: '^x' });

	expect(Root.safeParse('xyz').success).toBe(true);
	expect(Root.safeParse('abc').success).toBe(false);
	expect(Root.safeParse(42).success).toBe(true);
});

test('keyword-only schemas check every type their keywords constrain', async () => {
	const Root = await compileToZod({ minLength: 2, minimum: 5 });

	expect(Root.safeParse('a').success).toBe(false);
	expect(Root.safeParse('ab').success).toBe(true);
	expect(Root.safeParse(1).success).toBe(false);
	expect(Root.safeParse(5).success).toBe(true);
	expect(Root.safeParse(null).success).toBe(true);
	expect(Root.safeParse({}).success).toBe(true);
});

test('keyword-only schemas keep object and array keywords together', async () => {
	const Root = await compileToZod({
		properties: { a: { type: 'string' } },
		minItems: 1,
	});

	expect(Root.safeParse({ a: 'x' }).success).toBe(true);
	expect(Root.safeParse({ a: 1 }).success).toBe(false);
	expect(Root.safeParse(['x']).success).toBe(true);
	expect(Root.safeParse([]).success).toBe(false);
	expect(Root.safeParse('anything').success).toBe(true);
});

test('keyword-only schemas report each issue once', async () => {
	const minProperties = await compileToZod({ minProperties: 1 });
	const missingProperty = minProperties.safeParse({});

	expect(missingProperty.success).toBe(false);
	expect(missingProperty.success ? [] : missingProperty.error.issues).toHaveLength(1);

	const uniqueItems = await compileToZod({ uniqueItems: true });
	const duplicateItems = uniqueItems.safeParse([1, 1]);

	expect(duplicateItems.success).toBe(false);
	expect(duplicateItems.success ? [] : duplicateItems.error.issues).toHaveLength(1);

	const mixed = await compileToZod({ minProperties: 1, minLength: 2 });
	const shortString = mixed.safeParse('');
	const emptyObject = mixed.safeParse({});

	expect(shortString.success).toBe(false);
	expect(shortString.success ? [] : shortString.error.issues).toHaveLength(1);
	expect(emptyObject.success).toBe(false);
	expect(emptyObject.success ? [] : emptyObject.error.issues).toHaveLength(1);
});

test('not narrows a keyword-only subschema to the parent type', async () => {
	const Root = await compileToZod({ type: 'object', not: { pattern: 'x' } });

	expect(Root.safeParse({}).success).toBe(false);
});

test('$refs into prefixItems survive schema normalization', async () => {
	const Root = await compileToZod({
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: {
			list: {
				type: 'array',
				prefixItems: [{ type: 'string' }],
				items: { type: 'number' },
			},
			first: { $ref: '#/properties/list/prefixItems/0' },
		},
		required: ['list', 'first'],
	} as unknown as JSONSchema);

	expect(Root.safeParse({ list: ['a', 1], first: 'b' }).success).toBe(true);
	expect(Root.safeParse({ list: ['a', 1], first: 1 }).success).toBe(false);
});

test('propertyNames sees keys before the object strips them', async () => {
	const Root = await compileToZod({
		type: 'object',
		propertyNames: { pattern: '^[a-z]+$' },
	});

	expect(Root.safeParse({ abc: 1 }).success).toBe(true);
	expect(Root.safeParse({ Abc: 1 }).success).toBe(false);
});

test('dependencies sees undeclared keys before the object strips them', async () => {
	const Root = await compileToZod({
		type: 'object',
		properties: { a: { type: 'string' } },
		dependencies: { a: ['b'] },
	});

	expect(Root.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
	expect(Root.safeParse({ a: 'x' }).success).toBe(false);
});
