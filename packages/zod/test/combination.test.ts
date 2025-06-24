import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('schema combinations', () => {
	describe('allOf (AND)', () => {
		test('2 objects', async () => {
			await expect(
				compile({
					allOf: [
						{ type: 'object', properties: { field1: { type: 'string' } } },
						{ type: 'object', properties: { field2: { type: 'number' } } },
					],
				})
			).toMatchCode(ts`
      export const Root = z.intersection(
          z.object({
            field1: z.string().optional()
          }),
          z.object({
            field2: z.number().optional(),
          })
        )
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('empty allOf -> never type', async () => {
			const result = await compile({ allOf: [] });
			expect(result).toMatchCode(ts`
        export const Root = z.never();
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('allOf with non-object types', async () => {
			await expect(
				compile({
					allOf: [{ type: 'string' }, { type: 'number' }],
				})
			).toMatchCode(ts`
        export const Root = z.intersection(z.string(), z.number());
        export type Root = z.infer<typeof Root>;
      `);
		});

		test('throw error for more than 2 subschemas', async () => {
			await expect(
				compile({
					allOf: [
						{ type: 'object', properties: { field1: { type: 'string' } } },
						{ type: 'object', properties: { field2: { type: 'number' } } },
						{ type: 'object', properties: { field3: { type: 'boolean' } } },
					],
				})
			).rejects.toThrow(
				'Intersection of more than two schemas is not supported'
			);
		});
	});

	test('anyOf (OR)', async () => {
		await expect(
			compile({
				anyOf: [
					{ type: 'object', properties: { field1: { type: 'string' } } },
					{ type: 'object', properties: { field2: { type: 'number' } } },
				],
			})
		).toMatchCode(ts`
      export const Root = z.union([
        z.object({
          field1: z.string().optional()
        }),
        z.object({
          field2: z.number().optional(),
        })
      ])
      export type Root = z.infer<typeof Root>;
    `);
	});

	// Inspired by this document:
	// https://datatracker.ietf.org/doc/html/draft-json-schema-language-00#section-5.3.7
	test('oneOf (exclusive OR)', async () => {
		await expect(
			compile({
				discriminator: 'name',
				oneOf: [
					{
						type: 'object',
						properties: { name: { const: 'a' }, field1: { type: 'string' } },
						required: ['name'],
					},
					{
						type: 'object',
						properties: { name: { const: 'b' }, field2: { type: 'number' } },
						required: ['name'],
					},
				],
			})
		).toMatchCode(ts`
      export const Root = z.discriminatedUnion('name', [
        z.object({
          name: z.literal('a'),
          field1: z.string().optional()
        }),
        z.object({
          name: z.literal('b'),
          field2: z.number().optional(),
        })
      ])
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('issue with duplicates', async () => {
		const result = await compile({
			$id: 'http://json-schema.org/draft-07/schema#',
			title: 'Core schema meta-schema',
			type: ['object', 'boolean'],
			properties: {
				$id: {
					type: 'string',
					format: 'uri-reference',
				},
				maxLength: { $ref: '#/definitions/nonNegativeInteger' },
				minLength: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
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

				nonNegativeInteger: {
					type: 'integer',
					minimum: 0,
				},
				nonNegativeIntegerDefault0: {
					allOf: [{ $ref: '#/definitions/nonNegativeInteger' }, { default: 0 }],
				},
				maxLength: { $ref: '#/definitions/nonNegativeInteger' },
				minLength: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
			},
		});

		expect(result).toMatchInlineSnapshot(`
			"export const SchemaArray = z.array(Schema).min(1);
			export type SchemaArray = z.infer<typeof SchemaArray>;

			export const NonNegativeInteger = z.int().min(0);
			export type NonNegativeInteger = z.infer<typeof NonNegativeInteger>;

			export const NonNegativeIntegerDefault0 = z.intersection(
				NonNegativeInteger,
				z.number().default(0)
			);
			export type NonNegativeIntegerDefault0 = z.infer<
				typeof NonNegativeIntegerDefault0
			>;

			export const MinLength = NonNegativeIntegerDefault0;
			export type MinLength = z.infer<typeof MinLength>;

			export const MaxLength = NonNegativeInteger;
			export type MaxLength = z.infer<typeof MaxLength>;

			export const Schema = z
				.union([
					z
						.object({
							$id: z.string().optional(),
							maxLength: NonNegativeInteger.optional(),
							minLength: NonNegativeIntegerDefault0.optional(),
							items: z.union([Schema, SchemaArray]).default(true),
						})
						.meta({ id: 'http://json-schema.org/draft-07/schema#' }),
					z.boolean().meta({ id: 'http://json-schema.org/draft-07/schema#' }),
				])
				.meta({
					id: 'http://json-schema.org/draft-07/schema#',
					title: 'Core schema meta-schema',
				});
			export type Schema = z.infer<typeof Schema>;
			"
		`);
	});
});
