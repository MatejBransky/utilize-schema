import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('numberic types', () => {
	test('multiples', async () => {
		await expect(
			compile({
				type: 'number',
				multipleOf: 2,
			})
		).toMatchCode(ts`
      export const Root = z.number().multipleOf(2)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('range', async () => {
		await expect(
			compile({
				type: 'number',
				minimum: 1,
				maximum: 10,
			})
		).toMatchCode(ts`
      export const Root = z.number().min(1).max(10)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('exclusive range', async () => {
		await expect(
			compile({
				type: 'number',
				exclusiveMinimum: 1,
				exclusiveMaximum: 10,
			})
		).toMatchCode(ts`
      export const Root = z.number().gt(1).lt(10)
      export type Root = z.infer<typeof Root>;
    `);
	});
});
