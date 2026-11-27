import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('object index signatures', () => {
	test('widens a typed additionalProperties with the declared property types', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' },
				},
				required: ['name'],
				additionalProperties: { type: 'string' },
			})
		).toMatchCode(ts`
			export interface Root {
				name: string;
				age?: number;
				[key: string]: string | number | undefined;
			}
		`);
	});

	test('renders objects without declared properties as index signatures', async () => {
		await expect(compile({ type: 'object' })).toMatchCode(ts`
			export interface Root {
				[key: string]: unknown;
			}
		`);

		await expect(compile({ type: 'object', additionalProperties: { type: 'number' } }))
			.toMatchCode(ts`
				export interface Root {
					[key: string]: number;
				}
			`);

		await expect(compile({ type: 'object', additionalProperties: false })).toMatchCode(ts`
			export interface Root {
				[key: string]: never;
			}
		`);
	});

	test('allows any key when patternProperties is combined with additionalProperties', async () => {
		await expect(
			compile({
				type: 'object',
				patternProperties: { '^x-': { type: 'number' } },
			})
		).toMatchCode(ts`
			export interface Root {
				[key: string]: unknown;
			}
		`);
	});
});
