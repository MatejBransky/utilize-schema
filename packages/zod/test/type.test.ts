import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('type', () => {
	test('unknown', async () => {
		await expect(compile({})).toMatchCode(ts`
      export const Root = z.unknown()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('null', async () => {
		await expect(compile({ type: 'null' })).toMatchCode(ts`
      export const Root = z.null()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('boolean', async () => {
		await expect(compile({ type: 'boolean' })).toMatchCode(ts`
      export const Root = z.boolean()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('number', async () => {
		await expect(compile({ type: 'number' })).toMatchCode(ts`
      export const Root = z.number()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('integer', async () => {
		await expect(compile({ type: 'integer' })).toMatchCode(ts`
      export const Root = z.int()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('string', async () => {
		await expect(compile({ type: 'string' })).toMatchCode(ts`
      export const Root = z.string()
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('record (= additionalProperties)', async () => {
		await expect(
			compile({
				type: 'object',
				additionalProperties: { type: 'boolean' },
			})
		).toMatchCode(ts`
      export const Root = z.record(z.string(), z.boolean())
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('object without additional props', async () => {
		await expect(
			compile({ type: 'object', properties: { field: { type: 'boolean' } } })
		).toMatchCode(ts`
      export const Root = z.object({
        field: z.boolean().optional(),
      })
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('object with additional props', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'boolean' } },
				additionalProperties: { type: 'boolean' },
			})
		).toMatchCode(ts`
      export const Root = z.object({
        field: z.boolean().optional(),
      }).catchall(z.boolean())
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('object with any additional props', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'boolean' } },
				additionalProperties: true,
			})
		).toMatchCode(ts`
      export const Root = z.looseObject({
        field: z.boolean().optional(),
      })
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('strict object', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'boolean' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
      export const Root = z.strictObject({
        field: z.boolean().optional(),
      })
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('array', async () => {
		await expect(compile({ type: 'array', items: { type: 'string' } }))
			.toMatchCode(ts`
        export const Root = z.array(z.string())
        export type Root = z.infer<typeof Root>;
      `);
	});

	test('array with multiple items schemas (tuple)', async () => {
		await expect(
			compile({
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
			})
		).toMatchCode(ts`
      export const Root = z.tuple([
        z.string(),
        z.number(),
        z.boolean(),
      ])
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('array with multiple items schemas and additionalItems schema (typle with spread)', async () => {
		await expect(
			compile({
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }],
				additionalItems: { type: 'boolean' },
			})
		).toMatchCode(ts`
      export const Root = z.tuple([
        z.string(),
        z.number(),
      ], z.boolean())
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('literal', async () => {
		await expect(compile({ const: 'test' })).toMatchCode(ts`
      export const Root = z.literal('test')
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('literal null', async () => {
		await expect(compile({ const: null })).toMatchCode(ts`
      export const Root = z.literal(null)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('enum of strings (z.enum)', async () => {
		await expect(
			compile({
				enum: ['option1', 'option2', 'option3'],
			})
		).toMatchCode(ts`
      export const Root = z.enum(['option1', 'option2', 'option3'])
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('enum of various types (z.literal)', async () => {
		await expect(
			compile({
				enum: ['option1', 2, true, null],
			})
		).toMatchCode(ts`
      export const Root = z.literal([
        'option1',
        2,
        true,
        null,
      ])
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('unknown with default number', async () => {
		await expect(compile({ default: 0 })).toMatchCode(ts`
      export const Root = z.number().default(0)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('unknown with default string', async () => {
		await expect(compile({ default: 'test' })).toMatchCode(ts`
      export const Root = z.string().default('test')
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('unknown with default boolean', async () => {
		await expect(compile({ default: true })).toMatchCode(ts`
      export const Root = z.boolean().default(true)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('multiple types', async () => {
		await expect(
			compile({
				type: ['object', 'boolean'],
				properties: { field: { type: 'string' } },
				default: true,
			})
		).toMatchCode(ts`
      export const Root = z.union([
        z.object({
          field: z.string().optional(),
        }),
        z.boolean(),
      ]).default(true)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test("property with default value doesn't have optional part", async () => {
		const result = await compile({
			type: 'object',
			properties: {
				stringValue: { type: 'string', default: 'test' },
				booleanValue: { type: 'boolean', default: false },
			},
		});

		expect(result).toMatchCode(ts`
      export const Root = z.object({
        stringValue: z.string().default('test'),
        booleanValue: z.boolean().default(false)
      })
      export type Root = z.infer<typeof Root>
    `);
	});
});
