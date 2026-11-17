import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

const schemaSuffix = (name: string) => `${name}Schema`;

describe('name mapping', () => {
	test('suffixes the schema variable and keeps the type name', async () => {
		await expect(compile({ type: 'string', title: 'Foobar' }, { schemaName: schemaSuffix }))
			.toMatchCode(ts`
      export const FoobarSchema = z.string().meta({ title: 'Foobar' });
      export type Foobar = z.infer<typeof FoobarSchema>;
    `);
	});

	test('suffixes the type and keeps the schema variable name', async () => {
		await expect(compile({ type: 'string', title: 'Foobar' }, { typeName: schemaSuffix }))
			.toMatchCode(ts`
      export const Foobar = z.string().meta({ title: 'Foobar' });
      export type FoobarSchema = z.infer<typeof Foobar>;
    `);
	});

	test('uses one name when both mappers return it', async () => {
		await expect(
			compile(
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
			compile(
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
			compile(
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
		await expect(compile({ type: 'string', title: 'Foobar' }, { typeName: () => 'foobar-schema' }))
			.toMatchCode(ts`
      export const Foobar = z.string().meta({ title: 'Foobar' });
      export type FoobarSchema = z.infer<typeof Foobar>;
    `);
	});

	test('renames cyclic value aliases with the schema variable', async () => {
		await expect(
			compile(
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
});
