import { describe, expect, test } from 'vitest';

import { compileSchema, generate, mapName } from '../src';

import { compile, ts } from './test-utils';

const schemaSuffix = (name: string) => `${name}Schema`;

/** Two definitions where one's resolved name is the other's suffixed name. */
const personAndPersonSchema = {
	type: 'object',
	properties: {
		person: { $ref: '#/$defs/Person' },
		personSchema: { $ref: '#/$defs/PersonSchema' },
	},
	$defs: {
		Person: { type: 'string' },
		PersonSchema: { type: 'number' },
	},
} as const;

const personAndPersonSchemaRoot = (schemaName: string) => `Schema.StructWithRest(
	Schema.Struct({
		person: Schema.optionalKey(Schema.suspend(() => ${schemaName === 'RootSchema' ? 'PersonSchema' : 'Person'})),
		personSchema: Schema.optionalKey(Schema.suspend(() => ${schemaName === 'RootSchema' ? 'PersonSchemaSchema' : 'PersonSchema'})),
	}),
	[Schema.Record(Schema.String, Schema.Json)]
)`;

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

	test("does not let a mapped schema variable take another schema's resolved name", async () => {
		await expect(compile(personAndPersonSchema, { schemaName: schemaSuffix })).toMatchCode(ts`
			export const PersonSchema = Schema.String;

			export type Person = typeof PersonSchema.Type;

			export const PersonSchemaSchema = Schema.Finite;

			export type PersonSchema = typeof PersonSchemaSchema.Type;

			export const RootSchema = ${personAndPersonSchemaRoot('RootSchema')};

			export type Root = typeof RootSchema.Type;
		`);
	});

	test("does not let a mapped type take another schema's resolved name", async () => {
		await expect(compile(personAndPersonSchema, { typeName: schemaSuffix })).toMatchCode(ts`
			export const Person = Schema.String;

			export type PersonSchema = typeof Person.Type;

			export const PersonSchema = Schema.Finite;

			export type PersonSchemaSchema = typeof PersonSchema.Type;

			export const Root = ${personAndPersonSchemaRoot('Root')};

			export type RootSchema = typeof Root.Type;
		`);
	});

	test('gives a schema and its type one name when both mappers agree, even after a collision', async () => {
		await expect(
			compile(personAndPersonSchema, { schemaName: schemaSuffix, typeName: schemaSuffix })
		).toMatchCode(ts`
			export const PersonSchema = Schema.String;

			export type PersonSchema = typeof PersonSchema.Type;

			export const PersonSchemaSchema = Schema.Finite;

			export type PersonSchemaSchema = typeof PersonSchemaSchema.Type;

			export const RootSchema = ${personAndPersonSchemaRoot('RootSchema')};

			export type RootSchema = typeof RootSchema.Type;
		`);
	});

	test('keeps the casing of a mapped name that is already an identifier', async () => {
		await expect(
			compile(
				{ type: 'string', title: 'Foobar' },
				{ schemaName: (name) => `${name.charAt(0).toLowerCase()}${name.slice(1)}Schema` }
			)
		).toMatchCode(ts`
			export const foobarSchema = Schema.String.annotate({ title: 'Foobar' });

			export type Foobar = typeof foobarSchema.Type;
		`);
	});

	test('does not let a mapped name shadow the effect import', async () => {
		await expect(
			compile(
				{ type: 'string', title: 'Foobar' },
				{ schemaName: () => 'Schema', typeName: () => 'Schema' }
			)
		).toMatchCode(ts`
			export const Schema1 = Schema.String.annotate({ title: 'Foobar' });

			export type Schema1 = typeof Schema1.Type;
		`);
	});

	test('keeps a cyclic value alias apart from the exported types', async () => {
		await expect(
			compile(
				{
					title: 'Node',
					type: 'object',
					properties: {
						children: { type: 'array', items: { $ref: '#' } },
						other: { $ref: '#/$defs/NodeSchemaValue' },
					},
					$defs: { NodeSchemaValue: { type: 'string' } },
				},
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
			export const NodeSchemaValueSchema = Schema.String;

			export type NodeSchemaValue = typeof NodeSchemaValueSchema.Type;

			type NodeSchemaValue1 = { children?: ReadonlyArray<NodeSchemaValue1>; other?: NodeSchemaValue };

			export const NodeSchema: Schema.Codec<NodeSchemaValue1> = Schema.StructWithRest(
				Schema.Struct({
					children: Schema.optionalKey(Schema.Array(Schema.suspend(() => NodeSchema))),
					other: Schema.optionalKey(Schema.suspend(() => NodeSchemaValueSchema)),
				}),
				[Schema.Record(Schema.String, Schema.Json)]
			).annotate({ title: 'Node' });

			export type Node = typeof NodeSchema.Type;
		`);
	});
});

describe('compileSchema', () => {
	test('passes the name mappers to the generator', async () => {
		const code = await compileSchema(
			{ type: 'string', title: 'Foobar' },
			{
				cwd: __dirname + '/',
				fileName: 'Root.json',
				schemaName: schemaSuffix,
				typeName: (name) => `${name}Type`,
			}
		);

		expect(code).toContain('export const FoobarSchema = ');
		expect(code).toContain('export type FoobarType = typeof FoobarSchema.Type;');
	});
});

describe('mapName', () => {
	test('returns the resolved name without a mapper', () => {
		expect(mapName('Foobar')).toBe('Foobar');
	});

	test('keeps a mapped name that is already an identifier', () => {
		expect(mapName('Foobar', () => 'foo_bar$1')).toBe('foo_bar$1');
	});

	test('turns an invalid mapped name into an identifier', () => {
		expect(mapName('Foobar', () => 'foobar-schema')).toBe('FoobarSchema');
	});

	test('falls back to the resolved name when the mapped name has no usable characters', () => {
		expect(mapName('Foobar', () => '---')).toBe('Foobar');
	});
});
