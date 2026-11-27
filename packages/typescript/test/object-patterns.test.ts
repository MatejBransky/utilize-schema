import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('object patterns and nested additionalProperties', () => {
	test('maps patternProperties to the index signature', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { id: { type: 'string' } },
				required: ['id'],
				patternProperties: {
					'^x-': { type: 'number' },
					'^y-': { type: 'string' },
				},
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				id: string;
				[key: string]: number | string;
			}
		`);
	});

	test('falls back when a pattern is not a valid regular expression', async () => {
		expect(
			await compile({
				type: 'object',
				required: ['a'],
				patternProperties: { '[': { type: 'string' } },
				additionalProperties: false,
			})
		).toContain('a: never;');
	});

	test('applies additionalProperties inside nested and inline objects', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					closed: {
						type: 'object',
						properties: { a: { type: 'string' } },
						required: ['a'],
						additionalProperties: false,
					},
					open: {
						type: 'object',
						properties: { a: { type: 'string' } },
						required: ['a'],
					},
				},
				required: ['closed', 'open'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				closed: {
					a: string;
				};
				open: {
					a: string;
					[key: string]: unknown;
				};
			}
		`);
	});
});
