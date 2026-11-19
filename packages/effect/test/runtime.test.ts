import type { JSONSchema } from '@utilize/json-schema';

import { describe, expect, test } from 'vitest';

import { compileModule, compileToSchema, decode } from './test-utils';

describe('objects', () => {
	test('rejects keys when additionalProperties is false', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { a: { type: 'string' } },
			required: ['a'],
			additionalProperties: false,
		});

		expect(decode(Root, { a: 'x' })).toEqual({ a: 'x' });
		expect(decode(Root, { a: 'x', b: 1 })).toBeUndefined();
		expect(decode(Root, { a: 1 })).toBeUndefined();
		expect(decode(Root, {})).toBeUndefined();
	});

	test('keeps extra keys when additionalProperties is not closed', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { a: { type: 'string' } },
		});

		expect(decode(Root, { a: 'x', b: [1] })).toEqual({ a: 'x', b: [1] });
	});

	test('validates extra keys against a typed additionalProperties', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { a: { type: 'string' } },
			required: ['a'],
			additionalProperties: { type: 'integer' },
		});

		expect(decode(Root, { a: 'x', b: 1, c: 2 })).toEqual({ a: 'x', b: 1, c: 2 });
		expect(decode(Root, { a: 'x', b: 1.5 })).toBeUndefined();
	});

	test('validates properties whose names exist on Object.prototype', async () => {
		const Root = await compileToSchema({
			properties: {
				['__proto__']: { type: 'number' },
				toString: { properties: { length: { type: 'string' } } },
				constructor: { type: 'number' },
			},
		} as JSONSchema);

		expect(decode(Root, {})).toEqual({});
		expect(decode(Root, { ['__proto__']: 12 })).toEqual({ ['__proto__']: 12 });
		expect(decode(Root, { ['__proto__']: 'text' })).toBeUndefined();
		expect(decode(Root, { toString: { length: 37 } })).toBeUndefined();
	});

	test('keeps a __proto__ property when merging allOf subschemas', async () => {
		const Root = await compileToSchema({
			type: 'object',
			allOf: [
				{ type: 'object', properties: { ['__proto__']: { type: 'number' } } },
				{ type: 'object', properties: { b: { type: 'string' } } },
			],
		} as JSONSchema);

		expect(decode(Root, { b: 'x' })).toEqual({ b: 'x' });
		expect(decode(Root, { b: 1 })).toBeUndefined();
		expect(decode(Root, { ['__proto__']: 12 })).toEqual({ ['__proto__']: 12 });
		expect(decode(Root, { ['__proto__']: 'text' })).toBeUndefined();
	});

	test('validates patternProperties and lets unmatched keys use additionalProperties', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: { id: { type: 'string' } },
			patternProperties: {
				'^S_': { type: 'string' },
				'^I_': { type: 'integer' },
			},
			additionalProperties: { type: 'boolean' },
		});

		expect(decode(Root, { id: 'x', S_name: 'a', I_count: 2, flag: true })).toEqual({
			id: 'x',
			S_name: 'a',
			I_count: 2,
			flag: true,
		});
		expect(decode(Root, { S_name: 1 })).toBeUndefined();
		expect(decode(Root, { I_count: 'a' })).toBeUndefined();
		expect(decode(Root, { other: 'a' })).toBeUndefined();
	});

	test('rejects unmatched keys when patternProperties closes the object', async () => {
		const Root = await compileToSchema({
			type: 'object',
			patternProperties: { '^S_': { type: 'string' } },
			additionalProperties: false,
		});

		expect(decode(Root, { S_name: 'a' })).toEqual({ S_name: 'a' });
		expect(decode(Root, { other: 'a' })).toBeUndefined();
	});

	test('applies propertyNames, minProperties and maxProperties', async () => {
		const Root = await compileToSchema({
			type: 'object',
			propertyNames: { type: 'string', minLength: 2 },
			minProperties: 1,
			maxProperties: 2,
		});

		expect(decode(Root, { ab: 1 })).toEqual({ ab: 1 });
		expect(decode(Root, { a: 1 })).toBeUndefined();
		expect(decode(Root, {})).toBeUndefined();
		expect(decode(Root, { ab: 1, cd: 2, ef: 3 })).toBeUndefined();
	});

	test('decodes to an empty record when only additionalProperties is false', async () => {
		const Root = await compileToSchema({ type: 'object', additionalProperties: false });

		expect(decode(Root, {})).toEqual({});
		expect(decode(Root, { a: 1 })).toBeUndefined();
	});

	test('applies dependencies to a schema without a type', async () => {
		const Root = await compileToSchema({ dependencies: { bar: ['foo'] } });

		expect(decode(Root, { foo: 1 })).toEqual({ foo: 1 });
		expect(decode(Root, { bar: 2 })).toBeUndefined();
		// `dependencies` only constrains objects.
		expect(decode(Root, ['bar'])).toEqual(['bar']);
	});
});

describe('arrays', () => {
	test('opens a tuple through items', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }, { type: 'integer' }],
			items: { type: 'boolean' },
			minItems: 1,
		});

		expect(decode(Root, [])).toBeUndefined();
		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 1, true, false])).toEqual(['a', 1, true, false]);
		expect(decode(Root, ['a', 1, 'b'])).toBeUndefined();
	});

	test('closes a tuple through items: false', async () => {
		const Root = await compileToSchema({
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			type: 'array',
			prefixItems: [{ type: 'string' }],
			items: false,
		});

		expect(decode(Root, ['a'])).toEqual(['a']);
		expect(decode(Root, ['a', 'b'])).toBeUndefined();
	});

	test('applies minItems, maxItems and uniqueItems outside of tuples', async () => {
		const Root = await compileToSchema({
			type: 'array',
			items: { type: 'number' },
			minItems: 2,
			maxItems: 3,
			uniqueItems: true,
		});

		expect(decode(Root, [1, 2])).toEqual([1, 2]);
		expect(decode(Root, [1])).toBeUndefined();
		expect(decode(Root, [1, 1])).toBeUndefined();
		expect(decode(Root, [1, 2, 3, 4])).toBeUndefined();
	});

	test('applies contains to a schema without a type', async () => {
		const Root = await compileToSchema({ contains: { const: 5 } });

		expect(decode(Root, [1, 5])).toEqual([1, 5]);
		expect(decode(Root, [1, 2])).toBeUndefined();
		expect(decode(Root, [])).toBeUndefined();
		// `contains` only constrains arrays.
		expect(decode(Root, {})).toEqual({});
		expect(decode(Root, 5)).toBe(5);
	});
});

describe('scalars', () => {
	test('applies string constraints in code points', async () => {
		const Root = await compileToSchema({
			type: 'string',
			minLength: 2,
			maxLength: 3,
		});

		expect(decode(Root, 'ab')).toBe('ab');
		expect(decode(Root, '😀😀')).toBe('😀😀');
		expect(decode(Root, 'a')).toBeUndefined();
		expect(decode(Root, 'abcd')).toBeUndefined();
	});

	test('applies an unanchored pattern', async () => {
		const Root = await compileToSchema({ type: 'string', pattern: 'a+' });

		expect(decode(Root, 'baa')).toBe('baa');
		expect(decode(Root, 'bb')).toBeUndefined();
	});

	test('applies numeric constraints', async () => {
		const Root = await compileToSchema({
			type: 'number',
			minimum: 1,
			exclusiveMaximum: 10,
			multipleOf: 0.5,
		});

		expect(decode(Root, 1)).toBe(1);
		expect(decode(Root, 9.5)).toBe(9.5);
		expect(decode(Root, 0.5)).toBeUndefined();
		expect(decode(Root, 10)).toBeUndefined();
		expect(decode(Root, 1.2)).toBeUndefined();
	});

	test('rejects fractional integers', async () => {
		const Root = await compileToSchema({ type: 'integer' });

		expect(decode(Root, 1)).toBe(1);
		expect(decode(Root, 1.5)).toBeUndefined();
	});
});

describe('composition', () => {
	test('decodes const and enum', async () => {
		const module = await compileModule({
			$defs: { Const: { const: 'fixed' }, Enum: { enum: ['a', 1, null] } },
			type: 'object',
			properties: {
				const: { $ref: '#/$defs/Const' },
				enum: { $ref: '#/$defs/Enum' },
			},
		});

		expect(decode(module.Const!, 'fixed')).toBe('fixed');
		expect(decode(module.Const!, 'other')).toBeUndefined();
		expect(decode(module.Enum!, 'a')).toBe('a');
		expect(decode(module.Enum!, 1)).toBe(1);
		expect(decode(module.Enum!, null)).toBeNull();
		expect(decode(module.Enum!, 'b')).toBeUndefined();
	});

	test('compares structured const values deeply', async () => {
		const object = await compileToSchema({ const: { foo: 'bar', baz: 'bax' } });
		const array = await compileToSchema({ const: [{ foo: 'bar' }] });

		expect(decode(object, { baz: 'bax', foo: 'bar' })).toEqual({ foo: 'bar', baz: 'bax' });
		expect(decode(object, { foo: 'bar' })).toBeUndefined();
		expect(decode(array, [{ foo: 'bar' }])).toEqual([{ foo: 'bar' }]);
		expect(decode(array, [2])).toBeUndefined();
	});

	test('keeps JSON types distinct in const and enum', async () => {
		const falseArray = await compileToSchema({ const: [false] });
		const mixed = await compileToSchema({ enum: [6, 'foo', [], true, { foo: 12 }] });

		expect(decode(falseArray, [false])).toEqual([false]);
		expect(decode(falseArray, [0])).toBeUndefined();
		expect(decode(mixed, { foo: 12 })).toEqual({ foo: 12 });
		expect(decode(mixed, { foo: false })).toBeUndefined();
		expect(decode(mixed, [])).toEqual([]);
		expect(decode(mixed, null)).toBeUndefined();
	});

	test('merges disjoint object subschemas from allOf', async () => {
		const Root = await compileToSchema({
			allOf: [
				{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
				{ type: 'object', properties: { b: { type: 'number' } } },
			],
		});

		expect(decode(Root, { a: 'x' })).toEqual({ a: 'x' });
		expect(decode(Root, { a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
		expect(decode(Root, { b: 1 })).toBeUndefined();
	});

	test('supports recursive references', async () => {
		const module = await compileModule({
			title: 'Tree',
			type: 'object',
			properties: {
				value: { type: 'number' },
				children: { type: 'array', items: { $ref: '#' } },
			},
			required: ['value'],
		});

		expect(
			decode(module.Tree!, {
				value: 1,
				children: [{ value: 2, children: [{ value: 3 }] }],
			})
		).toEqual({ value: 1, children: [{ value: 2, children: [{ value: 3 }] }] });
		expect(decode(module.Tree!, { value: 1, children: [{ value: 'nope' }] })).toBeUndefined();
	});

	test('keeps non-matching JSON types for schemas without a type', async () => {
		const Root = await compileToSchema({ minLength: 2 });

		expect(decode(Root, 'ab')).toBe('ab');
		expect(decode(Root, 'a')).toBeUndefined();
		expect(decode(Root, 1)).toBe(1);
		expect(decode(Root, null)).toBeNull();
	});

	test('applies the keywords next to anyOf', async () => {
		const Root = await compileToSchema({
			type: 'string',
			anyOf: [{ maxLength: 2 }, { minLength: 4 }],
		});

		expect(decode(Root, 'foobar')).toBe('foobar');
		expect(decode(Root, 'foo')).toBeUndefined();
		expect(decode(Root, 3)).toBeUndefined();
	});

	test('applies format next to anyOf', async () => {
		const Root = await compileToSchema({
			type: 'string',
			format: 'email',
			anyOf: [{ maxLength: 100 }, { minLength: 200 }],
		});

		expect(decode(Root, 'a@b.co')).toBe('a@b.co');
		expect(decode(Root, 'not-an-email')).toBeUndefined();
	});

	test('applies oneOf next to anyOf', async () => {
		const Root = await compileToSchema({
			anyOf: [{ type: 'number' }],
			oneOf: [{ minimum: 5 }, { maximum: 3 }],
		});

		expect(decode(Root, 2)).toBe(2);
		expect(decode(Root, 6)).toBe(6);
		expect(decode(Root, 4)).toBeUndefined();
	});

	test('counts identical oneOf branches separately', async () => {
		const duplicate = await compileToSchema({ oneOf: [true, true, false] });
		const single = await compileToSchema({ oneOf: [true, false] });

		expect(decode(duplicate, 'value')).toBeUndefined();
		expect(decode(single, 'value')).toBe('value');
	});
});

describe('annotations', () => {
	test('carries metadata without changing decoding', async () => {
		const module = await compileModule({
			type: 'string',
			title: 'Name',
			description: 'A name',
			default: 'anonymous',
			examples: ['Jane'],
			format: 'email',
		});

		expect(decode(module.Name!, 'jane@example.com')).toBe('jane@example.com');
	});
});

describe('filters without a schema constructor', () => {
	test('rejects values that match a not schema', async () => {
		const Root = await compileToSchema({
			type: 'string',
			not: { enum: ['admin', 'api'] },
		});

		expect(decode(Root, 'slug')).toBe('slug');
		expect(decode(Root, 'admin')).toBeUndefined();
	});

	test('applies if/then/else', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: {
				country: { type: 'string' },
				postalCode: { type: 'string' },
			},
			if: {
				properties: { country: { const: 'US' } },
				required: ['country'],
			},
			then: {
				properties: { postalCode: { pattern: '^[0-9]{5}$' } },
				required: ['postalCode'],
			},
			else: {
				properties: { postalCode: { minLength: 3 } },
			},
		});

		expect(decode(Root, { country: 'US', postalCode: '12345' })).toEqual({
			country: 'US',
			postalCode: '12345',
		});
		expect(decode(Root, { country: 'US', postalCode: '1234' })).toBeUndefined();
		expect(decode(Root, { country: 'US' })).toBeUndefined();
		expect(decode(Root, { country: 'CZ', postalCode: '123' })).toEqual({
			country: 'CZ',
			postalCode: '123',
		});
		expect(decode(Root, { country: 'CZ', postalCode: '1' })).toBeUndefined();
	});

	test('requires a matching array item for contains', async () => {
		const Root = await compileToSchema({
			type: 'array',
			items: { type: 'string' },
			contains: { const: 'featured' },
		});

		expect(decode(Root, ['featured', 'x'])).toEqual(['featured', 'x']);
		expect(decode(Root, ['x'])).toBeUndefined();
		expect(decode(Root, [])).toBeUndefined();
	});

	test('applies array and schema dependencies', async () => {
		const Root = await compileToSchema({
			type: 'object',
			properties: {
				card: { type: 'string' },
				billingAddress: { type: 'string' },
				coupon: { type: 'string' },
			},
			dependencies: {
				card: ['billingAddress'],
				coupon: {
					properties: { card: { type: 'string' } },
					required: ['card'],
				},
			},
		});

		expect(decode(Root, { card: '4242', billingAddress: 'Street 1' })).toEqual({
			card: '4242',
			billingAddress: 'Street 1',
		});
		expect(decode(Root, { card: '4242' })).toBeUndefined();
		expect(decode(Root, { coupon: 'SAVE', card: '4242', billingAddress: 'Street 1' })).toEqual({
			coupon: 'SAVE',
			card: '4242',
			billingAddress: 'Street 1',
		});
		expect(decode(Root, { coupon: 'SAVE' })).toBeUndefined();
		// `coupon` requires `card`, which in turn requires `billingAddress`.
		expect(decode(Root, { coupon: 'SAVE', card: '4242' })).toBeUndefined();
	});
});
