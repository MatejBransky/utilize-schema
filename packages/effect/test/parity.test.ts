import { parse } from '@utilize/json-schema';
import { generate as generateZod } from '@utilize/zod';
import { Schema } from 'effect';
import { describe, expect, test } from 'vitest';
import type { z } from 'zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generate } from '../src';
import type { TestSchema } from './test-utils';

interface ParityCase {
	name: string;
	schema: TestSchema;
	valid: unknown[];
	invalid: unknown[];
}

/**
 * The Zod generator is the reference implementation, so parity is checked by
 * running the same values through both generated schemas instead of asserting
 * hand-written expectations that could drift from the reference behavior.
 *
 * Values are compared by validity only: the two targets decode differently
 * (Zod applies `.default()` and strips excess keys, Effect keeps the shape of
 * the input), but both must accept and reject the same values.
 */
const cases: ParityCase[] = [
	{
		name: 'string length',
		schema: { type: 'string', minLength: 2, maxLength: 3 },
		valid: ['ab', 'abc'],
		invalid: ['a', 'abcd', 1, null],
	},
	{
		name: 'string pattern',
		schema: { type: 'string', pattern: '^[a-z]+$' },
		valid: ['abc'],
		invalid: ['ABC', '', 1],
	},
	{
		name: 'number bounds',
		schema: { type: 'number', minimum: 1, maximum: 10 },
		valid: [1, 10],
		invalid: [0, 11, '1'],
	},
	{
		name: 'exclusive bounds',
		schema: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
		valid: [0.5],
		invalid: [0, 1],
	},
	{
		name: 'multipleOf',
		schema: { type: 'number', multipleOf: 0.5 },
		valid: [1.5, -2],
		invalid: [1.2],
	},
	{
		name: 'integer',
		schema: { type: 'integer' },
		valid: [1, -3],
		invalid: [1.5, '1'],
	},
	{
		name: 'enum',
		schema: { enum: ['a', 1, null] },
		valid: ['a', 1, null],
		invalid: ['b', 2, true],
	},
	{
		name: 'nullable type array',
		schema: { type: ['string', 'null'] },
		valid: ['a', null],
		invalid: [1, false],
	},
	{
		name: 'closed object',
		schema: {
			type: 'object',
			properties: { a: { type: 'string' }, b: { type: 'number' } },
			required: ['a'],
			additionalProperties: false,
		},
		valid: [{ a: 'x' }, { a: 'x', b: 1 }],
		invalid: [{}, { a: 'x', c: 1 }, { a: 1 }, { b: 1 }],
	},
	{
		name: 'open object',
		schema: {
			type: 'object',
			properties: { a: { type: 'string' } },
			required: ['a'],
		},
		valid: [{ a: 'x' }, { a: 'x', extra: true }],
		invalid: [{ a: 1 }, {}],
	},
	{
		name: 'typed additionalProperties',
		schema: {
			type: 'object',
			properties: { a: { type: 'string' } },
			additionalProperties: { type: 'integer' },
		},
		valid: [{ a: 'x', b: 1 }],
		invalid: [{ a: 'x', b: 1.5 }],
	},
	{
		name: 'propertyNames',
		schema: {
			type: 'object',
			propertyNames: { pattern: '^[a-z]+$' },
		},
		valid: [{ ab: 1 }, { ab: 1, cd: 2 }],
		invalid: [{ A: 1 }, { ab: 1, Bc: 2 }],
	},
	{
		name: 'array checks',
		schema: {
			type: 'array',
			items: { type: 'number' },
			minItems: 1,
			maxItems: 2,
		},
		valid: [[1], [1, 2]],
		invalid: [[], [1, 2, 3], ['a']],
	},
	{
		name: 'closed tuple',
		schema: {
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }, { type: 'number' }],
			items: false,
			minItems: 2,
		},
		valid: [['a', 1]],
		invalid: [['a'], ['a', 1, 2], [1, 1]],
	},
	{
		name: 'open tuple',
		schema: {
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }],
			items: { type: 'number' },
			minItems: 1,
		},
		valid: [['a'], ['a', 1, 2]],
		invalid: [[], [1], ['a', 'b']],
	},
	{
		name: 'contains',
		schema: { type: 'array', items: { type: 'string' }, contains: { const: 'x' } },
		valid: [['x'], ['a', 'x']],
		invalid: [['a'], [], ['x', 1]],
	},
	{
		name: 'anyOf',
		schema: { anyOf: [{ type: 'string' }, { type: 'number' }] },
		valid: ['a', 1],
		invalid: [null, {}],
	},
	{
		name: 'oneOf with disjoint branches',
		schema: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		valid: ['a', 1],
		invalid: [null, {}],
	},
	{
		name: 'allOf objects',
		schema: {
			allOf: [
				{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
				{ type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
			],
		},
		valid: [{ a: 'x', b: 1 }],
		invalid: [{ a: 'x' }, { b: 1 }, {}],
	},
	{
		name: 'not',
		schema: { type: 'string', not: { enum: ['admin', 'api'] } },
		valid: ['slug', 'administrator'],
		invalid: ['admin', 'api'],
	},
	{
		name: 'if / then / else',
		schema: {
			type: 'object',
			properties: { country: { type: 'string' }, postal: { type: 'string' } },
			if: { properties: { country: { const: 'US' } }, required: ['country'] },
			then: { properties: { postal: { pattern: '^[0-9]{5}$' } }, required: ['postal'] },
			else: { properties: { postal: { minLength: 3 } } },
		},
		valid: [
			{ country: 'US', postal: '12345' },
			{ country: 'CA', postal: 'abc' },
			{ country: 'CA' },
		],
		invalid: [
			{ country: 'US', postal: 'abcd' },
			{ country: 'US' },
			{ country: 'CA', postal: 'ab' },
		],
	},
	{
		name: 'dependencies',
		schema: {
			type: 'object',
			properties: {
				card: { type: 'string' },
				billingAddress: { type: 'string' },
				coupon: { type: 'string' },
			},
			dependencies: {
				card: ['billingAddress'],
				coupon: { properties: { card: { type: 'string' } }, required: ['card'] },
			},
		},
		valid: [
			{},
			{ card: '4242', billingAddress: 'Street 1' },
			{ coupon: 'SAVE', card: '4242', billingAddress: 'Street 1' },
		],
		invalid: [{ card: '4242' }, { coupon: 'SAVE' }, { coupon: 'SAVE', card: '4242' }],
	},
	{
		name: 'local $refs',
		schema: {
			type: 'object',
			properties: { child: { $ref: '#/$defs/Child' } },
			required: ['child'],
			$defs: {
				Child: {
					type: 'object',
					properties: { id: { type: 'string' } },
					required: ['id'],
					additionalProperties: false,
				},
			},
		},
		valid: [{ child: { id: 'a' } }],
		invalid: [{ child: {} }, { child: { id: 1, extra: true } }],
	},
	{
		name: 'uniqueItems',
		schema: { type: 'array', items: { type: 'number' }, uniqueItems: true },
		valid: [[1, 2], []],
		invalid: [[1, 1]],
	},
	{
		name: 'minProperties',
		schema: { type: 'object', minProperties: 1 },
		valid: [{ a: 1 }],
		invalid: [{}],
	},
	{
		name: 'maxProperties',
		schema: { type: 'object', maxProperties: 1 },
		valid: [{ a: 1 }],
		invalid: [{ a: 1, b: 2 }],
	},
	{
		name: 'recursion',
		schema: {
			type: 'object',
			properties: {
				value: { type: 'number' },
				children: { type: 'array', items: { $ref: '#' } },
			},
			required: ['value'],
		},
		valid: [{ value: 1 }, { value: 1, children: [{ value: 2, children: [{ value: 3 }] }] }],
		invalid: [{}, { value: 'x' }, { value: 1, children: [{ value: 'x' }] }],
	},
];

describe('parity with @utilize/zod', () => {
	test.each(cases)('$name accepts and rejects the same values', async (testCase) => {
		const [zodRoot, effectRoot] = await Promise.all([
			loadRoot(testCase.schema, 'zod'),
			loadRoot(testCase.schema, 'effect'),
		]);

		for (const value of testCase.valid) {
			expect(zodValid(zodRoot, value), `zod should accept ${JSON.stringify(value)}`).toBe(true);
			expect(Schema.is(effectRoot)(value), `effect should accept ${JSON.stringify(value)}`).toBe(
				true
			);
		}

		for (const value of testCase.invalid) {
			expect(zodValid(zodRoot, value), `zod should reject ${JSON.stringify(value)}`).toBe(false);
			expect(Schema.is(effectRoot)(value), `effect should reject ${JSON.stringify(value)}`).toBe(
				false
			);
		}
	});
});

/**
 * JSON Schema defines `format` as an annotation, so Effect keeps it as
 * metadata while the Zod generator validates known formats. That is a design
 * difference, not a gap, so it is pinned here instead of in the parity table.
 */
describe('design differences', () => {
	test('format is validated by Zod and only annotated by Effect', async () => {
		const schema: TestSchema = { type: 'string', format: 'email' };
		const [zodRoot, effectRoot] = await Promise.all([
			loadRoot(schema, 'zod'),
			loadRoot(schema, 'effect'),
		]);

		expect(Schema.is(effectRoot)('not-an-email')).toBe(true);
		expect(zodValid(zodRoot, 'not-an-email')).toBe(false);
	});

	test('an empty allOf is vacuous for Effect and never for Zod', async () => {
		const schema: TestSchema = { allOf: [] };
		const [zodRoot, effectRoot] = await Promise.all([
			loadRoot(schema, 'zod'),
			loadRoot(schema, 'effect'),
		]);

		expect(Schema.is(effectRoot)(1)).toBe(true);
		expect(zodValid(zodRoot, 1)).toBe(false);
	});
});

async function loadRoot(schema: TestSchema, target: 'zod' | 'effect') {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const file = join(directory, `${target}.ts`);

	try {
		const { root } = await parse(schema as never, {
			cwd: __dirname + '/',
			fileName: 'Root.json',
		});
		const code =
			target === 'zod'
				? generateZod(root, { importZod: true })
				: generate(root, { importEffect: true });

		await writeFile(file, code);

		const module = (await import(file)) as Record<string, unknown>;

		return module.Root as Parameters<typeof Schema.is>[0];
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function zodValid(schema: unknown, value: unknown): boolean {
	return (schema as z.ZodType).safeParse(value).success;
}
