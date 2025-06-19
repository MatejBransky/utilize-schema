import { describe, expect, test } from 'vitest';

import { fileURLToPath } from 'node:url';

import { compile, ts } from '../test-utils';

describe('type', () => {
	test('null', async () => {
		await expect(compile({ type: 'null' })).toMatchCode(ts`
      export const Unknown = z.null()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('boolean', async () => {
		await expect(compile({ type: 'boolean' })).toMatchCode(ts`
      export const Unknown = z.boolean()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('object', async () => {
		await expect(
			compile({ type: 'object', properties: { field: { type: 'string' } } })
		).toMatchCode(ts`
      export const Unknown = z.object({
        field: z.string().optional(),
      })
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('array', async () => {
		await expect(compile({ type: 'array', items: { type: 'string' } }))
			.toMatchCode(ts`
        export const Unknown = z.array(z.string())
        export type Unknown = z.infer<typeof Unknown>;
      `);
	});

	test('number', async () => {
		await expect(compile({ type: 'number' })).toMatchCode(ts`
      export const Unknown = z.number()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('string', async () => {
		await expect(compile({ type: 'string' })).toMatchCode(ts`
      export const Unknown = z.string()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('integer', async () => {
		await expect(compile({ type: 'integer' })).toMatchCode(ts`
      export const Unknown = z.int()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('any', async () => {
		await expect(compile({})).toMatchCode(ts`
      export const Unknown = z.any()
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('literal', async () => {
		await expect(compile({ const: 'test' })).toMatchCode(ts`
      export const Unknown = z.literal('test')
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('literal null', async () => {
		await expect(compile({ const: null })).toMatchCode(ts`
      export const Unknown = z.literal(null)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('enum of strings (z.enum)', async () => {
		await expect(
			compile({
				enum: ['option1', 'option2', 'option3'],
			})
		).toMatchCode(ts`
      export const Unknown = z.enum(['option1', 'option2', 'option3'])
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test.only('enum (z.enum)', async () => {
		const cwd = __dirname + '/';
		// const cwd = fileURLToPath(new URL(import.meta.url));
		const result = await compile(
			{
				type: 'object',
				properties: {
					name: { type: 'string' },
					dataType: { $ref: './definitions/DataType.json' },
					dataType2: {
						$ref: './definitions/DataType.json',
					},
					category: { $ref: '#/definitions/Category' },
					// TODO: relative paths are not supported yet
					// https://github.com/APIDevTools/json-schema-ref-parser/pull/261/files
					info: { $ref: './definitions/Info.json' },
				},
				definitions: {
					Category: { type: 'string' },
				},
			},
			{
				dereference: {
					cwd,
					$refOptions: {},
				},
			}
		);

		expect(result).toMatchInlineSnapshot(`
			"export const DataType = z
				.enum([
					'BOOLEAN',
					'DATE',
					'DATETIME',
					'FLOAT',
					'INTEGER',
					'LONG',
					'STRING',
					'UNKNOWN',
				])
				.meta({ title: 'DataType' });
			export type DataType = z.infer<typeof DataType>;

			export const Category = z.string();
			export type Category = z.infer<typeof Category>;

			export const OriginalDataType = z.enum([
				'UNKNOWN',
				'STRING',
				'NUMBER',
				'BOOLEAN',
				'DATE',
				'DATETIME',
				'ARRAY',
				'OBJECT',
			]);
			export type OriginalDataType = z.infer<typeof OriginalDataType>;

			export const Info = z.object({
				local: z.boolean().optional(),
				originalDataType: OriginalDataType.optional(),
			});
			export type Info = z.infer<typeof Info>;

			export const Unknown = z.object({
				name: z.string().optional(),
				dataType: DataType.default('STRING'),
				dataType2: DataType.optional(),
				category: Category.optional(),
				info: Info.optional(),
			});
			export type Unknown = z.infer<typeof Unknown>;
			"
		`);

		expect(result).toMatchCode(ts`
      export const DataType = z
        .enum([
          'BOOLEAN',
          'DATE',
          'DATETIME',
          'FLOAT',
          'INTEGER',
          'LONG',
          'STRING',
          'UNKNOWN',
        ])
        .meta({ title: 'DataType' });
      export type DataType = z.infer<typeof DataType>;

      export const Category = z.string();
			export type Category = z.infer<typeof Category>;

      export const Unknown = z.object({
        name: z.string().optional(),
        dataType: DataType.default('STRING'),
        dataType2: DataType.optional(),
        category: Category.optional(),
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('enum of various types (z.literal)', async () => {
		await expect(
			compile({
				enum: ['option1', 2, true, null],
			})
		).toMatchCode(ts`
      export const Unknown = z.literal([
        'option1',
        2,
        true,
        null,
      ])
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('unknown with default number', async () => {
		await expect(compile({ default: 0 })).toMatchCode(ts`
      export const Unknown = z.number().default(0)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('unknown with default string', async () => {
		await expect(compile({ default: 'test' })).toMatchCode(ts`
      export const Unknown = z.string().default('test')
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('unknown with default boolean', async () => {
		await expect(compile({ default: true })).toMatchCode(ts`
      export const Unknown = z.boolean().default(true)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('multiple types', async () => {
		await expect(
			compile({
				type: ['object', 'string'],
				properties: { field: { type: 'string' } },
			})
		).toMatchCode(ts`
      export const Unknown = z.union([
        z.object({
          field: z.string().optional(),
        }),
        z.string(),
      ])
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});
});
