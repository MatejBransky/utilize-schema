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

	test('keeps an unmergeable pattern unsupported', async () => {
		await expect(compile({ allOf: [{ pattern: '^a' }, { pattern: 'b$' }] })).rejects.toThrow(
			/allOf/
		);
	});
});
