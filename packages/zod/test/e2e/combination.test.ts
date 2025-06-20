import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

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
      export const Unknown = z.intersection(
          z.object({
            field1: z.string().optional()
          }),
          z.object({
            field2: z.number().optional(),
          })
        )
        export type Unknown = z.infer<typeof Unknown>;
      `);
		});

		test('empty allOf -> never type', async () => {
			const result = await compile({ allOf: [] });
			expect(result).toMatchCode(ts`
        export const Unknown = z.never();
        export type Unknown = z.infer<typeof Unknown>;
      `);
		});

		test('allOf with non-object types', async () => {
			await expect(
				compile({
					allOf: [{ type: 'string' }, { type: 'number' }],
				})
			).toMatchCode(ts`
        export const Unknown = z.intersection(z.string(), z.number());
        export type Unknown = z.infer<typeof Unknown>;
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
				'Zod does not support intersections with more than two members. Please refactor your schema.'
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
      export const Unknown = z.union([
        z.object({
          field1: z.string().optional()
        }),
        z.object({
          field2: z.number().optional(),
        })
      ])
      export type Unknown = z.infer<typeof Unknown>;
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
      export const Unknown = z.discriminatedUnion('name', [
        z.object({
          name: z.literal('a'),
          field1: z.string().optional()
        }),
        z.object({
          name: z.literal('b'),
          field2: z.number().optional(),
        })
      ])
      export type Unknown = z.infer<typeof Unknown>;
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
		console.log(result);

		expect(result).toMatchInlineSnapshot(`
			"export const NonNegativeInteger = z.int().min(0);
			export type NonNegativeInteger = z.infer<typeof NonNegativeInteger>;

			export const NonNegativeIntegerDefault0 = z.intersection(
				NonNegativeInteger,
				z.number().default(0)
			);
			export type NonNegativeIntegerDefault0 = z.infer<
				typeof NonNegativeIntegerDefault0
			>;

			export const SchemaArray = z.array(CoreSchemaMetaSchema).min(1);
			export type SchemaArray = z.infer<typeof SchemaArray>;

			export const CoreSchemaMetaSchema = z
				.union([
					z.object({
						$id: z.string().optional(),
						maxLength: NonNegativeInteger.optional(),
						minLength: NonNegativeIntegerDefault0.optional(),
						items: z.union([CoreSchemaMetaSchema, SchemaArray]).default(true),
					}),
					z.boolean(),
				])
				.meta({ title: 'Core schema meta-schema' });
			export type CoreSchemaMetaSchema = z.infer<typeof CoreSchemaMetaSchema>;
			"
		`);

		// expect(result).toMatchCode(ts`
		//     export const CoreSchemaMetaSchema = z.union([
		//       z.object({
		//           $id: z.string().optional(),
		//         }).meta({ title: 'Core schema meta-schema' }),
		//       z.boolean().meta({ title: 'Core schema meta-schema' }),
		//     ]).meta({ title: 'Core schema meta-schema' });
		//     export type CoreSchemaMetaSchema = z.infer<typeof CoreSchemaMetaSchema>;
		//   `);
	});
});
