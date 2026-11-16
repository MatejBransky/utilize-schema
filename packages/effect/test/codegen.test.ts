import { describe, expect, test } from 'vitest';

import { compile, compileModule, ts } from './test-utils';

describe('code generation', () => {
	test('exports a const and a type for the root schema', async () => {
		const result = await compile({ type: 'string', minLength: 1 });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.String.check(Schema.isMinCodePoints(1));

			export type Root = typeof Root.Type;
		`);
	});

	test('maps scalar keywords to checks', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				name: { type: 'string', minLength: 1, description: 'The name' },
				age: { type: 'integer', minimum: 0 },
				score: { type: 'number', exclusiveMaximum: 10 },
				flag: { type: 'boolean' },
				nothing: { type: 'null' },
			},
			required: ['name'],
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(
				Schema.Struct({
					name: Schema.String.check(Schema.isMinCodePoints(1)).annotate({ description: 'The name' }),
					age: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
					score: Schema.optionalKey(Schema.Finite.check(Schema.isLessThan(10))),
					flag: Schema.optionalKey(Schema.Boolean),
					nothing: Schema.optionalKey(Schema.Null),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('preserves extra keys and filters them when the object is closed', async () => {
		const result = await compile({
			type: 'object',
			properties: { a: { type: 'string' } },
			required: ['a'],
			additionalProperties: false,
			minProperties: 1,
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(Schema.Struct({ a: Schema.String }), [
				Schema.Record(Schema.String, Schema.Json),
			]).check(
				Schema.makeFilter((value) =>
					Object.keys(value).every((key) => ['a'].includes(key)) ? undefined : 'Unexpected property'
				),
				Schema.isMinProperties(1)
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('validates typed additional properties with a filter', async () => {
		const result = await compile({
			type: 'object',
			properties: { a: { type: 'string' } },
			additionalProperties: { type: 'integer' },
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(Schema.Struct({ a: Schema.optionalKey(Schema.String) }), [
				Schema.Record(Schema.String, Schema.Json),
			]).check(
				Schema.makeFilter((value) =>
					Object.entries(value).every(
						([key, entry]) => ['a'].includes(key) || Schema.is(Schema.Int)(entry)
					)
						? undefined
						: 'Property does not match the schema'
				)
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('decodes a single record when only additionalProperties is given', async () => {
		const result = await compile({ type: 'object', additionalProperties: { type: 'string' } });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Record(Schema.String, Schema.String);

			export type Root = typeof Root.Type;
		`);
	});

	test('builds closed tuples', async () => {
		const result = await compile({
			type: 'array',
			prefixItems: [{ type: 'string' }, { type: 'integer' }],
			items: false,
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Tuple([
				Schema.optionalKey(Schema.String),
				Schema.optionalKey(Schema.Int),
			]);

			export type Root = typeof Root.Type;
		`);
	});

	test('builds open tuples with a rest schema', async () => {
		const result = await compile({
			type: 'array',
			prefixItems: [{ type: 'string' }],
			items: { type: 'integer' },
			minItems: 1,
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Int]);

			export type Root = typeof Root.Type;
		`);
	});

	test('applies array checks', async () => {
		const result = await compile({
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
			maxItems: 2,
			uniqueItems: true,
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Array(Schema.String).check(
				Schema.isMinLength(1),
				Schema.isMaxLength(2),
				Schema.isUnique()
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('emits one definition per standalone schema and suspends references', async () => {
		const result = await compile({
			$defs: { Child: { type: 'object', properties: { id: { type: 'string' } } } },
			type: 'object',
			properties: { child: { $ref: '#/$defs/Child' } },
		});

		await expect(result).toMatchCode(ts`
			export const Child = Schema.StructWithRest(
				Schema.Struct({ id: Schema.optionalKey(Schema.String) }),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Child = typeof Child.Type;

			export const Root = Schema.StructWithRest(
				Schema.Struct({ child: Schema.optionalKey(Schema.suspend(() => Child)) }),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('annotates recursive schemas with a value type', async () => {
		const result = await compile({
			title: 'Node',
			type: 'object',
			properties: {
				value: { type: 'string' },
				children: { type: 'array', items: { $ref: '#' } },
			},
			required: ['value'],
		});

		await expect(result).toMatchCode(ts`
			type NodeValue = { value: string; children?: ReadonlyArray<NodeValue> };

			export const Node: Schema.Codec<NodeValue> = Schema.StructWithRest(
				Schema.Struct({
					value: Schema.String,
					children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Node))),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			).annotate({ title: 'Node' });

			export type Node = typeof Node.Type;
		`);
	});

	test('maps anyOf and oneOf to unions', async () => {
		await expect(await compile({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toMatchCode(ts`
			export const Root = Schema.Union([Schema.String, Schema.Finite]);

			export type Root = typeof Root.Type;
		`);

		await expect(await compile({ oneOf: [{ type: 'string' }, { type: 'number' }] })).toMatchCode(ts`
			export const Root = Schema.Union([Schema.String, Schema.Finite], { mode: 'oneOf' });

			export type Root = typeof Root.Type;
		`);
	});

	test('merges disjoint object subschemas from allOf', async () => {
		const result = await compile({
			allOf: [
				{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
				{ type: 'object', properties: { b: { type: 'number' } } },
			],
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(
				Schema.Struct({ a: Schema.String, b: Schema.optionalKey(Schema.Finite) }),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('intersects more than two allOf subschemas', async () => {
		const result = await compile({
			allOf: [
				{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
				{ type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
				{ type: 'object', properties: { c: { type: 'boolean' } }, required: ['c'] },
			],
		});

		await expect(result).toMatchCode(ts`
			export const Root = Schema.StructWithRest(
				Schema.Struct({
					a: Schema.String,
					b: Schema.Finite,
					c: Schema.Boolean,
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Root.Type;
		`);
	});

	test('treats an empty allOf as no constraint', async () => {
		const result = await compile({ allOf: [] });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Json;

			export type Root = typeof Root.Type;
		`);
	});

	test('maps a union of types to a union of schemas', async () => {
		const result = await compile({ type: ['string', 'null'] });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Union([Schema.String, Schema.Null]);

			export type Root = typeof Root.Type;
		`);
	});

	test('emits boolean literals for const', async () => {
		await expect(await compile({ const: false })).toMatchCode(ts`
			export const Root = Schema.Literal(false);

			export type Root = typeof Root.Type;
		`);

		await expect(await compile({ const: true })).toMatchCode(ts`
			export const Root = Schema.Literal(true);

			export type Root = typeof Root.Type;
		`);
	});

	test('keeps every JSON type for schemas without a type', async () => {
		const result = await compile({ minLength: 2 });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Union([
				Schema.Null,
				Schema.Boolean,
				Schema.String.check(Schema.isMinCodePoints(2)),
				Schema.Finite,
				Schema.JsonObject,
				Schema.Array(Schema.Json),
			]);

			export type Root = typeof Root.Type;
		`);
	});

	test('emits literals for const and enum', async () => {
		await expect(await compile({ const: 'fixed' })).toMatchCode(ts`
			export const Root = Schema.Literal('fixed');

			export type Root = typeof Root.Type;
		`);

		await expect(await compile({ enum: ['a', 'b'] })).toMatchCode(ts`
			export const Root = Schema.Literals(['a', 'b']);

			export type Root = typeof Root.Type;
		`);
	});

	test('adds the effect import when requested', async () => {
		const result = await compile({ type: 'string' }, { importEffect: true });

		await expect(result).toMatchCode(ts`
			import { Schema } from 'effect';

			export const Root = Schema.String;

			export type Root = typeof Root.Type;
		`);
	});

	test('names schemas from title and $id and avoids the Schema import', async () => {
		const module = await compileModule({
			$defs: {
				Id: { $id: 'https://example.com/schemas/User', type: 'string' },
				Titled: { title: 'Schema', type: 'number' },
			},
			type: 'object',
			properties: {
				user: { $ref: '#/$defs/Id' },
				number: { $ref: '#/$defs/Titled' },
			},
		});

		expect(new Set(Object.keys(module))).toEqual(new Set(['Root', 'Schema1', 'User']));
	});
});
