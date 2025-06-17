import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

describe('object', () => {
	test('properties', async () => {
		await expect(
			compile({ type: 'object', properties: { field: { type: 'string' } } })
		).toMatchCode(ts`
      export const Unknown = z.object({
        field: z.string().optional(),
      })
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('required properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'string' } },
				required: ['field'],
			})
		).toMatchCode(ts`
      export const Unknown = z.object({
        field: z.string(),
      })
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('typed additional properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'string' } },
				additionalProperties: { type: 'number' },
			})
		).toMatchCode(ts`
      export const Unknown = z.object({
        field: z.string().optional(),
      }).catchall(z.number())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('any additional properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'string' } },
				additionalProperties: true,
			})
		).toMatchCode(ts`
      export const Unknown = z.object({
        field: z.string().optional(),
      }).catchall(z.unknown())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('no additional properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { field: { type: 'string' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
      export const Unknown = z.strictObject({
        field: z.string().optional(),
      })
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('additional-only properties (ala support for records)', async () => {
		await expect(
			compile({
				type: 'object',
				additionalProperties: { type: 'number' },
			})
		).toMatchCode(ts`
      export const Unknown = z.object({}).catchall(z.number())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});
});
