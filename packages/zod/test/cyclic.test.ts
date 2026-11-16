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
      export const B = z.object({
        get a() {
          return A.optional();
        },
      });
      export type B = z.infer<typeof B>;

      export const A = z.object({
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
      export const ListCycleObject = z.object({
        get list() {
          return ListCycle.optional();
        },
      });
      export type ListCycleObject = z.infer<typeof ListCycleObject>;

      export const ListCycle = z.array(ListCycleObject);
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
      export const Root = z.object({
        get items() {
          return z.union([Root, SchemaArray]).default(true);
        },
      });
      export type Root = z.infer<typeof Root>;

      export const SchemaArray = z.array(Root).min(1);
      export type SchemaArray = z.infer<typeof SchemaArray>;
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
});

describe('cycles that cannot be deferred with a getter', () => {
	test('array-only property cycle fails at compile time', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					list: { type: 'array', items: { $ref: '#/properties/list' } },
				},
			})
		).rejects.toThrow(/Cannot generate a type-safe Zod schema/);
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
		).rejects.toThrow(/Cannot generate a type-safe Zod schema/);
	});

	test('array-to-array cycle fails at compile time', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { $ref: './definitions/ArrayPairA.json' } },
			})
		).rejects.toThrow(/#\/items/);
	});

	test('additionalProperties self reference fails at compile time', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { name: { type: 'string' } },
				additionalProperties: { $ref: '#' },
			})
		).rejects.toThrow(/additionalProperties/);
	});
});

const metaSchemaLike: JSONSchema = {
	type: 'object',
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
