import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('boolean type', () => {
	test('default true', async () => {
		await expect(compile({ type: 'boolean', default: true })).toMatchCode(ts`
      export const Root = z.boolean().default(true)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('default false', async () => {
		await expect(compile({ type: 'boolean', default: false })).toMatchCode(ts`
      export const Root = z.boolean().default(false)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('default string true', async () => {
		await expect(compile({ type: 'boolean', default: 'true' })).toMatchCode(ts`
      export const Root = z.boolean().default(true)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('default string false', async () => {
		await expect(compile({ type: 'boolean', default: 'false' })).toMatchCode(ts`
      export const Root = z.boolean().default(false)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('const true', async () => {
		await expect(compile({ const: true })).toMatchCode(ts`
      export const Root = z.literal(true)
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('const false', async () => {
		await expect(compile({ const: false })).toMatchCode(ts`
      export const Root = z.literal(false)
      export type Root = z.infer<typeof Root>;
    `);
	});
});
