import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';
import type { TestSchema } from './test-utils';

describe('code generation of arrays and simple literals', () => {
	test('renders arrays, tuples and their rest elements', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					list: { type: 'array', items: { type: 'string' } },
					mixed: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
					pair: {
						type: 'array',
						prefixItems: [{ type: 'number' }, { type: 'string' }],
						items: false,
					} as TestSchema,
					prefix: {
						type: 'array',
						prefixItems: [{ type: 'number' }, { type: 'string' }],
					} as TestSchema,
					empty: { type: 'array', items: false },
				},
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				list?: Array<string>;
				mixed?: Array<string | number>;
				pair?: [number?, string?];
				prefix?: [number?, string?, ...Array<unknown>];
				empty?: Array<never>;
			}
		`);
	});

	test('marks tuple elements below minItems as required', async () => {
		await expect(
			compile({
				type: 'array',
				prefixItems: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
				minItems: 2,
				items: false,
			})
		).toMatchCode(ts`
			export type Root = [string, number, boolean?];
		`);
	});

	test('maps enum and const to literal types', async () => {
		await expect(compile({ enum: ['open', 'closed'] })).toMatchCode(ts`
			export type Root = 'open' | 'closed';
		`);

		await expect(compile({ const: 42 })).toMatchCode(ts`
			export type Root = 42;
		`);

		await expect(compile({ enum: [] })).toMatchCode(ts`
			export type Root = never;
		`);
	});
});
