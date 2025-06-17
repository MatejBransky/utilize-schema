import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

describe('array', () => {
	test('untyped', async () => {
		await expect(compile({ type: 'array' })).toMatchCode(ts`
      export const Unknown = z.array(z.unknown())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('items', async () => {
		await expect(
			compile({
				type: 'array',
				items: { type: 'string' },
			})
		).toMatchCode(ts`
      export const Unknown = z.array(z.string())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('limits', async () => {
		await expect(
			compile({
				type: 'array',
				items: { type: 'string' },
				minItems: 1,
				maxItems: 5,
			})
		).toMatchCode(ts`
      export const Unknown = z.array(z.string()).min(1).max(5)
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('tuple', async () => {
		await expect(
			compile({
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }],
			})
		).toMatchCode(ts`
      export const Unknown = z.tuple([z.string(), z.number()])
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('tuple with rest', async () => {
		await expect(
			compile({
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
				additionalItems: { type: 'string' },
			})
		).toMatchCode(ts`
      export const Unknown = z.tuple([z.string(), z.number(), z.boolean()], z.string())
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});
});
