import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod, ts } from './test-utils';

describe('cyclic references', () => {
	test('mutual $defs cycle', async () => {
		const result = await compile({
			type: 'object',
			properties: { a: { $ref: '#/$defs/A' } },
			$defs: {
				A: {
					type: 'object',
					properties: { b: { $ref: '#/$defs/B' } },
				},
				B: {
					type: 'object',
					properties: { a: { $ref: '#/$defs/A' } },
				},
			},
		});

		await expect(result).toMatchCode(ts`
      type BValue = { a?: AValue };
      export const B: z.ZodType<BValue> = z.object({
        get a() {
          return A.optional();
        },
      });
      export type B = z.infer<typeof B>;

      type AValue = { b?: BValue };
      export const A: z.ZodType<AValue> = z.object({
        b: B.optional(),
      });
      export type A = z.infer<typeof A>;

      export const Root = z.object({
        a: A.optional(),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('object and array cycle across files', async () => {
		const result = await compile({
			type: 'object',
			properties: { list: { $ref: './definitions/ListCycle.json' } },
		});

		await expect(result).toMatchCode(ts`
      type ListCycleObjectValue = { list?: ListCycleValue };
      export const ListCycleObject: z.ZodType<ListCycleObjectValue> =
        z.object({
          get list() {
            return ListCycle.optional();
          },
        });
      export type ListCycleObject = z.infer<typeof ListCycleObject>;

      type ListCycleValue = ListCycleObjectValue[];
      export const ListCycle: z.ZodType<ListCycleValue> =
        z.array(ListCycleObject);
      export type ListCycle = z.infer<typeof ListCycle>;

      export const Root = z.object({
        list: ListCycle.optional(),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('array definition that refers back to its root', async () => {
		const result = await compile(metaSchemaLike);

		await expect(result).toMatchCode(ts`
      type RootValue = { items: RootValue | SchemaArrayValue } | boolean;
      export const Root: z.ZodType<RootValue> = z.union([
        z.object({
          get items() {
            return z.union([Root, SchemaArray]).default(true);
          },
        }),
        z.boolean(),
      ]);
      export type Root = z.infer<typeof Root>;

      type SchemaArrayValue = RootValue[];
      export const SchemaArray: z.ZodType<SchemaArrayValue> = z
        .array(Root)
        .min(1);
      export type SchemaArray = z.infer<typeof SchemaArray>;
    `);
	});

	test('array-to-array cycle', async () => {
		const result = await compile({
			type: 'object',
			properties: { a: { $ref: './definitions/ArrayPairA.json' } },
		});

		await expect(result).toMatchCode(ts`
      type ArrayPairAValue = ArrayPairBValue[];
      export const ArrayPairA: z.ZodType<ArrayPairAValue> = z.array(
        z.lazy(() => ArrayPairB),
      );
      export type ArrayPairA = z.infer<typeof ArrayPairA>;

      type ArrayPairBValue = ArrayPairAValue[];
      export const ArrayPairB: z.ZodType<ArrayPairBValue> =
        z.array(ArrayPairA);
      export type ArrayPairB = z.infer<typeof ArrayPairB>;

      export const Root = z.object({
        a: ArrayPairA.optional(),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('recursive additionalProperties', async () => {
		const result = await compile({
			type: 'object',
			properties: { name: { type: 'string' } },
			additionalProperties: { $ref: '#' },
		});

		await expect(result).toMatchCode(ts`
      interface RootValue {
        name?: string;
        [key: string]: string | RootValue | undefined;
      }
      export const Root: z.ZodType<RootValue> = z
        .object({
          name: z.string().optional(),
        })
        .catchall(z.lazy(() => Root));
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('recursive record', async () => {
		const result = await compile({
			type: 'object',
			additionalProperties: { $ref: '#' },
		});

		await expect(result).toMatchCode(ts`
      interface RootValue {
        [key: string]: RootValue;
      }
      export const Root: z.ZodType<RootValue> = z.record(
        z.string(),
        z.lazy(() => Root),
      );
      export type Root = z.infer<typeof Root>;
    `);
	});
});

describe('recursive references at runtime', () => {
	test('parses nested data across an object/array cycle', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { list: { $ref: './definitions/ListCycle.json' } },
		});

		expect(Root.safeParse({ list: [{ list: [{ list: [] }] }] }).success).toBe(true);
	});

	test('rejects an invalid node deep in an object/array cycle', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { list: { $ref: './definitions/ListCycle.json' } },
		});

		expect(Root.safeParse({ list: [{ list: [{ list: 'not a list' }] }] }).success).toBe(false);
	});

	test('parses nested data through an array definition cycle', async () => {
		const Root = await compileToZod(metaSchemaLike);

		expect(Root.safeParse({ items: [{}] }).success).toBe(true);
	});

	test('rejects an invalid value through an array definition cycle', async () => {
		const Root = await compileToZod(metaSchemaLike);

		expect(Root.safeParse({ items: [1] }).success).toBe(false);
	});

	test('parses nested arrays through an array-to-array cycle', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { a: { $ref: './definitions/ArrayPairA.json' } },
		});

		expect(Root.safeParse({ a: [[], []] }).success).toBe(true);
	});

	test('rejects an invalid value in an array-to-array cycle', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { a: { $ref: './definitions/ArrayPairA.json' } },
		});

		expect(Root.safeParse({ a: [1] }).success).toBe(false);
	});

	test('parses nested data through recursive additionalProperties', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { name: { type: 'string' } },
			additionalProperties: { $ref: '#' },
		});

		expect(Root.safeParse({ name: 'root', child: { name: 'child' } }).success).toBe(true);
	});

	test('rejects an invalid value in recursive additionalProperties', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { name: { type: 'string' } },
			additionalProperties: { $ref: '#' },
		});

		expect(Root.safeParse({ name: 'root', child: { name: 42 } }).success).toBe(false);
	});
});

describe('cycles without a type indirection', () => {
	test('a sibling structural branch does not anchor the cycle', async () => {
		await expect(
			compile({
				anyOf: [{ $ref: '#' }, { type: 'object' }],
			})
		).rejects.toThrow(/only passes through unions or aliases/);
	});

	test('union-only cycle fails at compile time', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { $ref: '#/$defs/A' } },
				$defs: {
					A: { anyOf: [{ $ref: '#/$defs/B' }, { type: 'null' }] },
					B: { anyOf: [{ $ref: '#/$defs/A' }, { type: 'null' }] },
				},
			})
		).rejects.toThrow(/only passes through unions or aliases/);
	});
});

const metaSchemaLike: JSONSchema = {
	type: ['object', 'boolean'],
	properties: {
		items: {
			anyOf: [{ $ref: '#' }, { $ref: '#/definitions/schemaArray' }],
			default: true,
		},
	},
	definitions: {
		schemaArray: {
			type: 'array',
			minItems: 1,
			items: { $ref: '#' },
		},
	},
};

describe('array-only cycles', () => {
	test('emits lazy for a standalone array cycle', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				list: { type: 'array', items: { $ref: '#/properties/list' } },
			},
		});

		expect(result).toContain('z.lazy');
	});

	test('parses nested data through a standalone array cycle', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				list: { type: 'array', items: { $ref: '#/properties/list' } },
			},
		});

		expect(Root.safeParse({ list: [[]] }).success).toBe(true);
		expect(Root.safeParse({ list: [1] }).success).toBe(false);
	});
});
