import { describe, expect, test } from 'vitest';

import { compile, compileToSchema, decode, ts } from './test-utils';

describe('allOf', () => {
	test('merges scalar constraints into the strictest bounds', async () => {
		const code = await compile({ allOf: [{ maximum: 30 }, { minimum: 20 }] });

		await expect(code).toMatchCode(ts`
			export const Root = Schema.Finite.check(
				Schema.isGreaterThanOrEqualTo(20),
				Schema.isLessThanOrEqualTo(30)
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('validates the merged bounds', async () => {
		const schema = await compileToSchema({ allOf: [{ maximum: 30 }, { minimum: 20 }] });

		expect(decode(schema, 25)).toBe(25);
		expect(decode(schema, 15)).toBeUndefined();
		expect(decode(schema, 35)).toBeUndefined();
	});

	test('ignores empty and true members', async () => {
		const code = await compile({ allOf: [{}, true, { type: 'number' }] });

		await expect(code).toMatchCode(ts`
			export const Root = Schema.Finite;

			export type Root = typeof Root.Type;
		`);
	});

	test('makes a false member reject everything', async () => {
		const code = await compile({ allOf: [{ type: 'string' }, false] });

		await expect(code).toMatchCode(ts`
			export const Root = Schema.Never;

			export type Root = typeof Root.Type;
		`);
	});

	test('flattens nested allOf', async () => {
		const code = await compile({ allOf: [{ allOf: [{ type: 'null' }] }] });

		await expect(code).toMatchCode(ts`
			export const Root = Schema.Null;

			export type Root = typeof Root.Type;
		`);
	});

	test('merges string length constraints', async () => {
		const schema = await compileToSchema({
			allOf: [{ minLength: 2 }, { maxLength: 4 }, { type: 'string' }],
		});

		expect(decode(schema, 'abc')).toBe('abc');
		expect(decode(schema, 'a')).toBeUndefined();
		expect(decode(schema, 'abcde')).toBeUndefined();
	});

	test('combines allOf with anyOf and oneOf constraints', async () => {
		const schema = await compileToSchema({
			allOf: [{ multipleOf: 2 }],
			anyOf: [{ multipleOf: 3 }],
			oneOf: [{ multipleOf: 5 }],
		});

		expect(decode(schema, 30)).toBe(30);
		expect(decode(schema, 12)).toBeUndefined();
		expect(decode(schema, 15)).toBeUndefined();
		expect(decode(schema, 10)).toBeUndefined();
		// The constraints only apply to numbers.
		expect(decode(schema, 'text')).toBe('text');
	});

	test('merges array item counts', async () => {
		const members = { allOf: [{ type: 'array' as const }, { minItems: 1 }] };
		const code = await compile(members);

		await expect(code).toMatchCode(ts`
			export const Root = Schema.Array(Schema.Json).check(Schema.isMinLength(1));

			export type Root = typeof Root.Type;
		`);

		const schema = await compileToSchema(members);
		expect(decode(schema, [1])).toEqual([1]);
		expect(decode(schema, [])).toBeUndefined();
		expect(decode(schema, 'text')).toBeUndefined();
	});

	test('filters array members that cannot be merged', async () => {
		const schema = await compileToSchema({
			allOf: [{ type: 'array', items: { type: 'number' } }, { minItems: 1 }],
		});

		expect(decode(schema, [1])).toEqual([1]);
		expect(decode(schema, [])).toBeUndefined();
		expect(decode(schema, ['text'])).toBeUndefined();
		expect(decode(schema, 'text')).toBeUndefined();
	});

	test('combines patterns that cannot be merged into one regex', async () => {
		const schema = await compileToSchema({ allOf: [{ pattern: '^a' }, { pattern: 'b$' }] });

		expect(decode(schema, 'ab')).toBe('ab');
		expect(decode(schema, 'a')).toBeUndefined();
		expect(decode(schema, 'ba')).toBeUndefined();
	});

	test('does not merge additionalProperties with properties from another member', async () => {
		const schema = await compileToSchema({
			allOf: [{ properties: { foo: {} } }],
			additionalProperties: { type: 'boolean' },
		});

		expect(decode(schema, { bar: true })).toEqual({ bar: true });
		// `additionalProperties` only considers the properties declared next to
		// it, so the allOf member's `foo` is still an additional property here.
		expect(decode(schema, { foo: 1, bar: true })).toBeUndefined();
	});

	test('checks a referenced member that cannot be merged', async () => {
		const schema = await compileToSchema({
			allOf: [{ $ref: '#/if' }],
			if: { type: 'integer' },
		});

		expect(decode(schema, 12)).toBe(12);
		expect(decode(schema, 'text')).toBeUndefined();
	});
});
