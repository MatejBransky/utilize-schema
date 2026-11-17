import { describe, expect, test } from 'vitest';

import { generate } from '../src';

import { compile, ts } from './test-utils';

const schemaSuffix = (name: string) => `${name}Schema`;

describe('name mapping', () => {
	test('suffixes the schema variable and keeps the type name', async () => {
		await expect(compile({ type: 'string', title: 'Foobar' }, { schemaName: schemaSuffix }))
			.toMatchCode(ts`
			export const FoobarSchema = Schema.String.annotate({ title: 'Foobar' });

			export type Foobar = typeof FoobarSchema.Type;
		`);
	});

	test('suffixes the type and keeps the schema variable name', async () => {
		await expect(compile({ type: 'string', title: 'Foobar' }, { typeName: schemaSuffix }))
			.toMatchCode(ts`
			export const Foobar = Schema.String.annotate({ title: 'Foobar' });

			export type FoobarSchema = typeof Foobar.Type;
		`);
	});

	test('uses one name when both mappers return it', async () => {
		await expect(
			compile(
				{ type: 'string', title: 'Foobar' },
				{ schemaName: schemaSuffix, typeName: schemaSuffix }
			)
		).toMatchCode(ts`
			export const FoobarSchema = Schema.String.annotate({ title: 'Foobar' });

			export type FoobarSchema = typeof FoobarSchema.Type;
		`);
	});

	test('renames $ref targets', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { field: { $ref: '#/$defs/MyType' } },
					$defs: { MyType: { type: 'string' } },
				},
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
			export const MyTypeSchema = Schema.String;

			export type MyType = typeof MyTypeSchema.Type;

			export const RootSchema = Schema.StructWithRest(
				Schema.Struct({
					field: Schema.optionalKey(Schema.suspend(() => MyTypeSchema)),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof RootSchema.Type;
		`);
	});

	test('keeps mapped names unique', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { field: { $ref: '#/$defs/MyType' } },
					$defs: { MyType: { type: 'string' } },
				},
				{ schemaName: () => 'Same' }
			)
		).toMatchCode(ts`
			export const Same1 = Schema.String;

			export type MyType = typeof Same1.Type;

			export const Same = Schema.StructWithRest(
				Schema.Struct({
					field: Schema.optionalKey(Schema.suspend(() => Same1)),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			);

			export type Root = typeof Same.Type;
		`);
	});

	test('keeps a mapped name a valid identifier', async () => {
		await expect(compile({ type: 'string', title: 'Foobar' }, { typeName: () => 'foobar-schema' }))
			.toMatchCode(ts`
			export const Foobar = Schema.String.annotate({ title: 'Foobar' });

			export type FoobarSchema = typeof Foobar.Type;
		`);
	});

	test('maps the fallback name of a boolean root', () => {
		const code = generate(false, {
			importEffect: false,
			schemaName: schemaSuffix,
			typeName: schemaSuffix,
		});

		expect(code).toBe(
			'export const RootSchema = Schema.Never;\n\nexport type RootSchema = typeof RootSchema.Type;\n'
		);
	});

	test('renames cyclic value aliases with the schema variable', async () => {
		await expect(
			compile(
				{
					title: 'Node',
					type: 'object',
					properties: {
						value: { type: 'string' },
						children: { type: 'array', items: { $ref: '#' } },
					},
					required: ['value'],
				},
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
			type NodeSchemaValue = { value: string; children?: ReadonlyArray<NodeSchemaValue> };

			export const NodeSchema: Schema.Codec<NodeSchemaValue> = Schema.StructWithRest(
				Schema.Struct({
					value: Schema.String,
					children: Schema.optionalKey(Schema.Array(Schema.suspend(() => NodeSchema))),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			).annotate({ title: 'Node' });

			export type Node = typeof NodeSchema.Type;
		`);
	});
});
