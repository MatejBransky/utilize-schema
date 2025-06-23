import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('reference', () => {
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

      export const MyType3 = z.boolean();
      export type MyType3 = z.infer<typeof MyType3>;

      export const Root = z.object({
        field: MyType.optional(),
        field2: MyType2.optional(),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('self-referencing', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				field: { $ref: '#' },
			},
		});

		expect(result).toMatchCode(ts`
      export const Root = z.object({
        get field() {
          return Root.optional()
        }
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('$ref used multiple times', async () => {
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

      export const Root = z.object({
        field1: MyType.optional(),
        field2WithDefault: MyType.default(true),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('external refs', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				name: { type: 'string' },
				dataType: { $ref: './definitions/DataType.json', default: 'STRING' },
				dataType2: {
					$ref: './definitions/DataType.json',
				},
				category: { $ref: '#/definitions/Category' },
				info: { $ref: './definitions/Info.json' },
			},
			definitions: {
				Category: { type: 'string' },
			},
		});

		expect(result).toMatchCode(ts`
      export const Category = z.string();
      export type Category = z.infer<typeof Category>;

      export const Meta = z.string();
      export type Meta = z.infer<typeof Meta>;

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

      export const Root = z.object({
        name: z.string().optional(),
        dataType: DataType.default('STRING'),
        dataType2: DataType.optional(),
        category: Category.optional(),
        info: Info.optional(),
      });
      export type Root = z.infer<typeof Root>;
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
      export const Root = z.object({
        value: z.string(),
        get next() {
          return Root.optional();
        },
      });
      export type Root = z.infer<typeof Root>;
    `);
	});
});
