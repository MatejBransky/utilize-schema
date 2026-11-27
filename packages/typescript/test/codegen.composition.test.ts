import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('code generation of composed schemas', () => {
	test('parenthesizes compound intersection members and tuple elements', async () => {
		await expect(
			compile({
				allOf: [
					{
						anyOf: [
							{
								type: 'object',
								properties: { a: { type: 'string' } },
								required: ['a'],
								additionalProperties: false,
							},
							{ type: 'null' },
						],
					},
					{
						type: 'object',
						properties: { b: { type: 'boolean' } },
						required: ['b'],
						additionalProperties: false,
					},
				],
			})
		).toMatchCode(ts`
			export type Root = ({ a: string } | null) & {
				b: boolean;
			};
		`);

		await expect(
			compile({
				type: 'array',
				prefixItems: [{ anyOf: [{ type: 'number' }, { type: 'null' }] }, { type: 'string' }],
				items: false,
			})
		).toMatchCode(ts`
			export type Root = [(number | null)?, string?];
		`);
	});

	test('does not treat operators inside string literals as top-level', async () => {
		await expect(compile({ allOf: [{ const: 'a|b' }, { enum: ['a|b', 'c'] }] })).toMatchCode(ts`
			export type Root = 'a|b' & ('a|b' | 'c');
		`);

		await expect(compile({ allOf: [{ const: 'a&b' }, { enum: ['a&b', 'c'] }] })).toMatchCode(ts`
			export type Root = 'a&b' & ('a&b' | 'c');
		`);
	});
});
