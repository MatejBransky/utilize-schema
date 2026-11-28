import { describe, expect, test } from 'vitest';

import { compileSchema, mapName } from '../src';

import { generateCode, ts } from './test-utils';

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

describe('name mapping', () => {
	test('suffixes the schema variable and keeps the type name', async () => {
		await expect(generateCode({ type: 'string', title: 'Foobar' }, { schemaName: schemaSuffix }))
			.toMatchCode(ts`
      export const FoobarSchema = z.string().meta({ title: 'Foobar' });
      export type Foobar = z.infer<typeof FoobarSchema>;
    `);
	});

	test('suffixes the type and keeps the schema variable name', async () => {
		await expect(generateCode({ type: 'string', title: 'Foobar' }, { typeName: schemaSuffix }))
			.toMatchCode(ts`
      export const Foobar = z.string().meta({ title: 'Foobar' });
      export type FoobarSchema = z.infer<typeof Foobar>;
    `);
	});

	test('uses one name when both mappers return it', async () => {
		await expect(
			generateCode(
				{ type: 'string', title: 'Foobar' },
				{ schemaName: schemaSuffix, typeName: schemaSuffix }
			)
		).toMatchCode(ts`
      export const FoobarSchema = z.string().meta({ title: 'Foobar' });
      export type FoobarSchema = z.infer<typeof FoobarSchema>;
    `);
	});

	test('renames $ref targets', async () => {
		await expect(
			generateCode(
				{
					type: 'object',
					properties: { field: { $ref: '#/$defs/MyType' } },
					$defs: { MyType: { type: 'string' } },
				},
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
      export const MyTypeSchema = z.string();
      export type MyType = z.infer<typeof MyTypeSchema>;

      export const RootSchema = z.object({ field: MyTypeSchema.optional() });
      export type Root = z.infer<typeof RootSchema>;
    `);
	});

	test('keeps mapped names unique', async () => {
		await expect(
			generateCode(
				{
					type: 'object',
					properties: { field: { $ref: '#/$defs/MyType' } },
					$defs: { MyType: { type: 'string' } },
				},
				{ schemaName: () => 'Same' }
			)
		).toMatchCode(ts`
      export const Same = z.string();
      export type MyType = z.infer<typeof Same>;

      export const Same1 = z.object({ field: Same.optional() });
      export type Root = z.infer<typeof Same1>;
    `);
	});

	test('keeps a mapped name a valid identifier', async () => {
		await expect(
			generateCode({ type: 'string', title: 'Foobar' }, { typeName: () => 'foobar-schema' })
		).toMatchCode(ts`
      export const Foobar = z.string().meta({ title: 'Foobar' });
      export type FoobarSchema = z.infer<typeof Foobar>;
    `);
	});

	test('renames cyclic value aliases with the schema variable', async () => {
		await expect(
			generateCode(
				{ type: 'object', properties: { field: { $ref: '#' } } },
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
      type RootSchemaValue = { field?: RootSchemaValue };
      export const RootSchema: z.ZodType<RootSchemaValue> = z.object({
        get field() {
          return RootSchema.optional();
        },
      });
      export type Root = z.infer<typeof RootSchema>;
    `);
	});

	test("does not let a mapped schema variable take another schema's resolved name", async () => {
		await expect(generateCode(personAndPersonSchema, { schemaName: schemaSuffix })).toMatchCode(ts`
      export const PersonSchemaSchema = z.number();
      export type PersonSchema = z.infer<typeof PersonSchemaSchema>;

      export const PersonSchema = z.string();
      export type Person = z.infer<typeof PersonSchema>;

      export const RootSchema = z.object({
        person: PersonSchema.optional(),
        personSchema: PersonSchemaSchema.optional(),
      });
      export type Root = z.infer<typeof RootSchema>;
    `);
	});

	test("does not let a mapped type take another schema's resolved name", async () => {
		await expect(generateCode(personAndPersonSchema, { typeName: schemaSuffix })).toMatchCode(ts`
      export const PersonSchema = z.number();
      export type PersonSchemaSchema = z.infer<typeof PersonSchema>;

      export const Person = z.string();
      export type PersonSchema = z.infer<typeof Person>;

      export const Root = z.object({
        person: Person.optional(),
        personSchema: PersonSchema.optional(),
      });
      export type RootSchema = z.infer<typeof Root>;
    `);
	});

	test('gives a schema and its type one name when both mappers agree, even after a collision', async () => {
		await expect(
			generateCode(personAndPersonSchema, { schemaName: schemaSuffix, typeName: schemaSuffix })
		).toMatchCode(ts`
      export const PersonSchemaSchema = z.number();
      export type PersonSchemaSchema = z.infer<typeof PersonSchemaSchema>;

      export const PersonSchema = z.string();
      export type PersonSchema = z.infer<typeof PersonSchema>;

      export const RootSchema = z.object({
        person: PersonSchema.optional(),
        personSchema: PersonSchemaSchema.optional(),
      });
      export type RootSchema = z.infer<typeof RootSchema>;
    `);
	});

	test('keeps the casing of a mapped name that is already an identifier', async () => {
		await expect(
			generateCode(
				{ type: 'string', title: 'Foobar' },
				{ schemaName: (name) => `${name.charAt(0).toLowerCase()}${name.slice(1)}Schema` }
			)
		).toMatchCode(ts`
      export const foobarSchema = z.string().meta({ title: 'Foobar' });
      export type Foobar = z.infer<typeof foobarSchema>;
    `);
	});

	test('does not let a mapped schema variable shadow the zod import', async () => {
		await expect(generateCode({ type: 'string', title: 'Foobar' }, { schemaName: () => 'z' }))
			.toMatchCode(ts`
      export const z1 = z.string().meta({ title: 'Foobar' });
      export type Foobar = z.infer<typeof z1>;
    `);
	});

	test('keeps a cyclic value alias apart from the exported types', async () => {
		await expect(
			generateCode(
				{
					type: 'object',
					properties: { self: { $ref: '#' }, other: { $ref: '#/$defs/RootSchemaValue' } },
					$defs: { RootSchemaValue: { type: 'string' } },
				},
				{ schemaName: schemaSuffix }
			)
		).toMatchCode(ts`
      export const RootSchemaValueSchema = z.string();
      export type RootSchemaValue = z.infer<typeof RootSchemaValueSchema>;

      type RootSchemaValue1 = { self?: RootSchemaValue1; other?: RootSchemaValue };
      export const RootSchema: z.ZodType<RootSchemaValue1> = z.object({
        get self() {
          return RootSchema.optional();
        },
        other: RootSchemaValueSchema.optional(),
      });
      export type Root = z.infer<typeof RootSchema>;
    `);
	});
});

describe('compileSchema', () => {
	const options = { cwd: __dirname + '/', fileName: 'Root.json' };

	test('passes the name mappers to the generator', async () => {
		const code = await compileSchema(
			{ type: 'string', title: 'Foobar' },
			{ ...options, schemaName: schemaSuffix, typeName: (name) => `${name}Type` }
		);

		expect(code).toContain('export const FoobarSchema = ');
		expect(code).toContain('export type FoobarType = z.infer<typeof FoobarSchema>;');
	});

	test('names $ref targets with the custom name resolver', async () => {
		const code = await compileSchema(
			{
				type: 'object',
				properties: { field: { $ref: '#/$defs/MyType' } },
				$defs: { MyType: { type: 'string' } },
			},
			{
				...options,
				customNameResolver: (schema) => (schema.type === 'string' ? 'Renamed' : undefined),
			}
		);

		expect(code).toContain('export const Renamed = z.string();');
		expect(code).toContain('Renamed.optional()');
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
