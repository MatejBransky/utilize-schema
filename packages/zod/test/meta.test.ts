import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('meta', () => {
	test('title (inferred schema name)', async () => {
		await expect(
			compile({
				type: 'string',
				title: 'Test Title',
			})
		).toMatchCode(ts`
      export const TestTitle = z.string().meta({ title: 'Test Title' })
      export type TestTitle = z.infer<typeof TestTitle>;
    `);
	});

	test('description', async () => {
		await expect(
			compile({
				description: 'This is a test description',
			})
		).toMatchCode(ts`
      export const Root = z.unknown().meta({ description: 'This is a test description' })
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('default', async () => {
		await expect(
			compile({
				type: 'string',
				default: 'default value',
			})
		).toMatchCode(ts`
      export const Root = z.string().default('default value')
      export type Root = z.infer<typeof Root>;
    `);
	});
});
