import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

describe('reference', () => {
	test('root $ref', async () => {
		await expect(
			compile({
				$ref: '#/definitions/MyType',
				definitions: {
					MyType: { type: 'string' },
				},
			})
		).toMatchCode(ts`
      export const Unknown = z.string();
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('local $refs', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					field: { $ref: '#/$defs/MyType' },
					field2: { $ref: '#/$defs/MyType2' },
				},
				$defs: {
					MyType: { type: 'string' },
					MyType2: { type: 'number' },
					MyType3: { type: 'boolean' },
				},
			})
		).toMatchCode(ts`
      export const MyType = z.string();
      export type MyType = z.infer<typeof MyType>;

      export const MyType2 = z.number();
      export type MyType2 = z.infer<typeof MyType2>;

      export const Unknown = z.object({
        field: MyType.optional(),
        field2: MyType2.optional(),
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test.only('$ref used multiple times', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				field1: { $ref: '#/$defs/MyType' },
				field2WithDefault: { $ref: '#/$defs/MyType', default: true },
			},
			$defs: {
				MyType: { type: 'boolean' },
			},
		});

		expect(result).toMatchCode(ts`
      export const MyType = z.boolean();
      export type MyType = z.infer<typeof MyType>;

      export const Unknown = z.object({
        field1: MyType.optional(),
        field2WithDefault: MyType.default(true),
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('external refs', async () => {
		const cwd = __dirname + '/';
		// const cwd = fileURLToPath(new URL(import.meta.url));
		const result = await compile(
			{
				type: 'object',
				properties: {
					name: { type: 'string' },
					dataType: { $ref: './definitions/DataType.json', default: 'STRING' },
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
    `);
	});

	test('cyclic reference', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				value: { type: 'string' },
				next: { $ref: '#' },
			},
			required: ['value'],
		});

		expect(result).toMatchCode(ts`
      export const Unknown = z.object({
        value: z.string(),
        get next() {
          return Unknown.optional();
        },
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});
});
