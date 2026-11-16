import { describe, expect, test } from 'vitest';

import { compileToZod } from './test-utils';

describe('allOf', () => {
	test('intersects more than two schemas', async () => {
		const Root = await compileToZod({
			allOf: [
				{
					type: 'object',
					properties: { a: { type: 'string' } },
					required: ['a'],
				},
				{
					type: 'object',
					properties: { b: { type: 'number' } },
					required: ['b'],
				},
				{
					type: 'object',
					properties: { c: { type: 'boolean' } },
					required: ['c'],
				},
			],
		});

		expect(Root.safeParse({ a: 'x', b: 1, c: true }).success).toBe(true);
		expect(Root.safeParse({ a: 'x', c: true }).success).toBe(false);
		expect(Root.safeParse({ a: 1, b: 1, c: true }).success).toBe(false);
	});
});
