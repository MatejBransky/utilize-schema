import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('object property rendering', () => {
	test('omits the index signature when additionalProperties is false', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { name: { type: 'string' } },
				required: ['name'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				name: string;
			}
		`);
	});

	test('escapes a backslash in a property key', async () => {
		expect(
			await compile({
				type: 'object',
				properties: { [String.raw`a\b`]: { type: 'string' } },
			})
		).toContain(String.raw`'a\\b'?: string;`);
	});

	test('marks readOnly properties as readonly', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					id: { type: 'string', readOnly: true },
					name: { type: 'string' },
				},
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				readonly id?: string;
				name?: string;
			}
		`);
	});
});
