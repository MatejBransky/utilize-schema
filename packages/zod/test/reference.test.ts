import type { JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { generateCode, compileToZod, ts } from './test-utils';

describe('reference', () => {
	test('local $refs', async () => {
		await expect(
			generateCode({
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
      export const MyType2 = z.number();
      export type MyType2 = z.infer<typeof MyType2>;

      export const MyType = z.string();
      export type MyType = z.infer<typeof MyType>;

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
		const result = await generateCode({
			type: 'object',
			properties: {
				field: { $ref: '#' },
			},
		});

		await expect(result).toMatchCode(ts`
      type RootValue = { field?: RootValue };
      export const Root: z.ZodType<RootValue> = z.object({
        get field() {
          return Root.optional()
        }
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('$ref used multiple times', async () => {
		const result = await generateCode({
			type: 'object',
			properties: {
				field1: { $ref: '#/$defs/MyType' },
				field2WithDefault: { $ref: '#/$defs/MyType', default: true },
			},
			$defs: {
				MyType: { type: 'boolean' },
			},
		});

		await expect(result).toMatchCode(ts`
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
		const result = await generateCode({
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

		await expect(result).toMatchCode(ts`
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

      export const Category = z.string();
      export type Category = z.infer<typeof Category>;

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

      export const Meta = z.string();
      export type Meta = z.infer<typeof Meta>;

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
		const result = await generateCode({
			type: 'object',
			properties: {
				value: { type: 'string' },
				next: { $ref: '#' },
			},
			required: ['value'],
		});

		await expect(result).toMatchCode(ts`
      type RootValue = { value: string; next?: RootValue };
      export const Root: z.ZodType<RootValue> = z.object({
        value: z.string(),
        get next() {
          return Root.optional();
        },
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('self-reference nested in array items', async () => {
		const result = await generateCode({
			type: 'object',
			properties: {
				children: { type: 'array', items: { $ref: '#' } },
			},
		});

		await expect(result).toMatchCode(ts`
      type RootValue = { children?: RootValue[] };
      export const Root: z.ZodType<RootValue> = z.object({
        get children() {
          return z.array(Root).optional();
        },
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('self-reference nested in anyOf', async () => {
		const result = await generateCode({
			type: 'object',
			properties: {
				parent: { anyOf: [{ $ref: '#' }, { type: 'null' }] },
			},
		});

		await expect(result).toMatchCode(ts`
      type RootValue = { parent?: RootValue | null };
      export const Root: z.ZodType<RootValue> = z.object({
        get parent() {
          return z.union([Root, z.null()]).optional();
        },
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('cyclic reference across files', async () => {
		const result = await generateCode({
			type: 'object',
			properties: {
				a: { $ref: './definitions/CycleA.json' },
			},
		});

		await expect(result).toMatchCode(ts`
      type CycleBValue = { a?: CycleAValue | null };
      export const CycleB: z.ZodType<CycleBValue> = z.object({
        get a() {
          return z.union([CycleA, z.null()]).optional();
        },
      });
      export type CycleB = z.infer<typeof CycleB>;

      type CycleAValue = { b?: CycleBValue };
      export const CycleA: z.ZodType<CycleAValue> = z.object({
        b: CycleB.optional(),
      });
      export type CycleA = z.infer<typeof CycleA>;

      export const Root = z.object({
        a: CycleA.optional(),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});
});

describe('recursive reference at runtime', () => {
	const treeSchema: JSONSchema = {
		type: 'object',
		properties: {
			name: { type: 'string' },
			children: { type: 'array', items: { $ref: '#' } },
		},
		required: ['name'],
	};

	test('parses a tree three levels deep', async () => {
		const Tree = await compileToZod(treeSchema);

		const result = Tree.safeParse({
			name: 'root',
			children: [{ name: 'child', children: [{ name: 'grandchild' }] }],
		});

		expect(result.success).toBe(true);
	});

	test('rejects an invalid node deep in the tree', async () => {
		const Tree = await compileToZod(treeSchema);

		const result = Tree.safeParse({
			name: 'root',
			children: [{ name: 'child', children: [{ name: 42 }] }],
		});

		expect(result.success).toBe(false);
	});

	test('parses nested data across a cyclic pair of files', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				a: { $ref: './definitions/CycleA.json' },
			},
		});

		const result = Root.safeParse({ a: { b: { a: { b: { a: null } } } } });

		expect(result.success).toBe(true);
	});
});

describe('boolean references', () => {
	test('$ref to true and false schemas', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				allowed: { $ref: '#/definitions/allowed' },
				denied: { $ref: '#/definitions/denied' },
			},
			definitions: {
				allowed: true,
				denied: false,
			},
		} satisfies JSONSchema);

		expect(Root.safeParse({ allowed: 'anything' }).success).toBe(true);
		expect(Root.safeParse({ denied: 'anything' }).success).toBe(false);
		expect(Root.safeParse({}).success).toBe(true);
	});
});
