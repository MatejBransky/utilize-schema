import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

describe('schema combinations', () => {
	test('allOf (AND)', async () => {
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
});
