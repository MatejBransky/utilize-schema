import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('required object properties', () => {
	test('types a required key that is not declared in properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { type: 'string' } },
				required: ['a', 'b'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				a: string;
				b: never;
			}
		`);

		await expect(
			compile({
				type: 'object',
				required: ['b'],
				additionalProperties: { type: 'number' },
			})
		).toMatchCode(ts`
			export interface Root {
				b: number;
				[key: string]: number;
			}
		`);
	});

	test('types a required key from a matching patternProperties schema', async () => {
		await expect(
			compile({
				type: 'object',
				required: ['x', 'y'],
				patternProperties: {
					'^x$': { type: 'string' },
					'^y': { type: 'number' },
				},
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				x: string;
				y: number;
				[key: string]: string | number;
			}
		`);

		// No pattern matches, so `additionalProperties` decides.
		await expect(
			compile({
				type: 'object',
				required: ['b'],
				patternProperties: { '^x-': { type: 'number' } },
				additionalProperties: { type: 'string' },
			})
		).toMatchCode(ts`
			export interface Root {
				b: string;
				[key: string]: string | number;
			}
		`);
	});
});
