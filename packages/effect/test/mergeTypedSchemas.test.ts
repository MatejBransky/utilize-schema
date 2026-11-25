import { describe, expect, test } from 'vitest';

import { parse } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { generate } from '../src';

import type { TestSchema } from './test-utils';

async function generateRaw(schema: TestSchema) {
	const parsed = await parse(schema, { cwd: __dirname, fileName: 'Root.json' });

	return generate(parsed.root, { importEffect: false });
}

describe('typed allOf merging characterization', () => {
	test('combines the strictest numeric bounds and narrows number to integer', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{
						type: 'number',
						minimum: 1,
						maximum: 30,
						exclusiveMinimum: 0,
						exclusiveMaximum: 40,
						multipleOf: 2,
					},
					{
						type: 'integer',
						minimum: 5,
						maximum: 20,
						exclusiveMinimum: 2,
						exclusiveMaximum: 25,
						multipleOf: 2,
					},
					{ maximum: 18 },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Int.check(Schema.isGreaterThanOrEqualTo(5), Schema.isLessThanOrEqualTo(18), Schema.isGreaterThan(2), Schema.isLessThan(25), Schema.isMultipleOf(2));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('keeps inferred scalar constraints open to other JSON types', async () => {
		await expect(await generateRaw({ allOf: [{ minLength: 2 }, { maxLength: 4 }] }))
			.toMatchInlineSnapshot(`
			"export const Root = Schema.Union([Schema.Null, Schema.Boolean, Schema.String.check(Schema.isMinCodePoints(2), Schema.isMaxCodePoints(4)), Schema.Finite, Schema.JsonObject, Schema.Array(Schema.Json)]);

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('ignores annotations and undefined-valued keywords while merging', async () => {
		const parsed = await parse(
			{
				allOf: [
					{ type: 'string', minLength: 2, title: 'First', description: 'Ignored' },
					{ type: 'string', maxLength: 4, examples: ['ab'] },
				],
			},
			{ cwd: __dirname, fileName: 'Root.json' }
		);
		Object.assign(parsed.root as ParsedJSONSchemaObject, { default: undefined });

		expect(generate(parsed.root, { importEffect: false })).toMatchInlineSnapshot(`
			"export const Root = Schema.String.check(Schema.isMinCodePoints(2), Schema.isMaxCodePoints(4));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not combine different patterns', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'string', pattern: '^a' },
					{ type: 'string', pattern: 'b$' },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.String.check(Schema.isPattern(new RegExp("^a", 'u'))).check(Schema.makeFilter((value) => Schema.is(Schema.String.check(Schema.isPattern(new RegExp("b$", 'u'))))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not combine different multiples', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'number', multipleOf: 2 },
					{ type: 'number', multipleOf: 3 },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Finite.check(Schema.isMultipleOf(2)).check(Schema.makeFilter((value) => Schema.is(Schema.Finite.check(Schema.isMultipleOf(3)))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not combine boolean exclusive bounds with numeric bounds', async () => {
		await expect(
			await generateRaw({
				$schema: 'http://json-schema.org/draft-04/schema#',
				allOf: [
					{ type: 'number', minimum: 0, exclusiveMinimum: true },
					{ type: 'number', minimum: 1 },
				],
			} as TestSchema)
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1), Schema.isGreaterThan(0));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('merges array counts and only keeps uniqueItems when true', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'array', minItems: 1, uniqueItems: false },
					{ type: 'array', maxItems: 5, uniqueItems: true },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Array(Schema.Json).check(Schema.isMinLength(1), Schema.isMaxLength(5), Schema.isUnique());

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('keeps inferred array constraints open to other JSON types', async () => {
		await expect(await generateRaw({ allOf: [{ minItems: 1 }, { maxItems: 3 }] }))
			.toMatchInlineSnapshot(`
			"export const Root = Schema.Union([Schema.Null, Schema.Boolean, Schema.String, Schema.Finite, Schema.JsonObject, Schema.Array(Schema.Json).check(Schema.isMinLength(1), Schema.isMaxLength(3))]);

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not merge array item schemas', async () => {
		await expect(
			await generateRaw({
				allOf: [{ type: 'array', items: { type: 'number' } }, { minItems: 1 }],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Array(Schema.Finite).check(Schema.makeFilter((value) => Schema.is(Schema.Union([Schema.Null, Schema.Boolean, Schema.String, Schema.Finite, Schema.JsonObject, Schema.Array(Schema.Json).check(Schema.isMinLength(1))]))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not merge members that constrain different type families', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'number', minimum: 1 },
					{ type: 'string', minLength: 2 },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)).check(Schema.makeFilter((value) => Schema.is(Schema.String.check(Schema.isMinCodePoints(2)))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not infer a type from ambiguous keyword families', async () => {
		await expect(
			await generateRaw({
				allOf: [{ minimum: 1, minLength: 2 }, { maximum: 5 }],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Union([Schema.Null, Schema.Boolean, Schema.String.check(Schema.isMinCodePoints(2)), Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)), Schema.JsonObject, Schema.Array(Schema.Json)]).check(Schema.makeFilter((value) => Schema.is(Schema.Union([Schema.Null, Schema.Boolean, Schema.String, Schema.Finite.check(Schema.isLessThanOrEqualTo(5)), Schema.JsonObject, Schema.Array(Schema.Json)]))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('keeps integer when an integer member precedes a number member', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'integer', minimum: 1 },
					{ type: 'number', maximum: 5 },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(5));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('keeps identical patterns in the merged schema', async () => {
		await expect(
			await generateRaw({
				allOf: [{ pattern: '^a' }, { type: 'string', pattern: '^a' }],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.String.check(Schema.isPattern(new RegExp("^a", 'u')));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('omits uniqueItems when no member enables it', async () => {
		await expect(
			await generateRaw({ allOf: [{ type: 'array', uniqueItems: false }, { minItems: 1 }] })
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Array(Schema.Json).check(Schema.isMinLength(1));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('keeps contradictory bounds instead of rejecting the schema', async () => {
		await expect(
			await generateRaw({
				allOf: [
					{ type: 'number', minimum: 10 },
					{ type: 'number', maximum: 0 },
				],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(10), Schema.isLessThanOrEqualTo(0));

			export type Root = typeof Root.Type;
			"
		`);
	});

	test('does not merge references or non-scalar declared types', async () => {
		await expect(
			await generateRaw({
				$defs: { Number: { type: 'number', minimum: 1 } },
				allOf: [{ $ref: '#/$defs/Number' }, { maximum: 5 }],
			})
		).toMatchInlineSnapshot(`
			"export const Number = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1));

			export type Number = typeof Number.Type;

			export const Root = Schema.Union([Schema.suspend(() => Number)]).check(Schema.makeFilter((value) => Schema.is(Schema.Union([Schema.Null, Schema.Boolean, Schema.String, Schema.Finite.check(Schema.isLessThanOrEqualTo(5)), Schema.JsonObject, Schema.Array(Schema.Json)]))(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);

		await expect(
			await generateRaw({
				allOf: [{ type: 'boolean' }, { type: 'boolean' }],
			})
		).toMatchInlineSnapshot(`
			"export const Root = Schema.Boolean.check(Schema.makeFilter((value) => Schema.is(Schema.Boolean)(value) ? undefined : 'Value does not match every schema in "allOf"'));

			export type Root = typeof Root.Type;
			"
		`);
	});
});
