import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('code generation of basic types', () => {
	test('exports a type for a scalar root schema', async () => {
		await expect(compile({ type: 'string', minLength: 1 })).toMatchCode(ts`
			export type Root = string;
		`);
	});

	test('emits an interface for an object with declared properties', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'integer' },
					active: { type: 'boolean' },
					tags: { type: 'array', items: { type: 'string' } },
				},
				required: ['name'],
			})
		).toMatchCode(ts`
			export interface Root {
				name: string;
				age?: number;
				active?: boolean;
				tags?: Array<string>;
				[key: string]: unknown;
			}
		`);
	});

	test('quotes property names that are not identifiers', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					'foo-bar': { type: 'string' },
					'0': { type: 'boolean' },
					$ref: { type: 'number' },
				},
				required: ['foo-bar'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				"0"?: boolean;
				"foo-bar": string;
				$ref?: number;
			}
		`);
	});

	test('renders nested objects inline', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					meta: {
						type: 'object',
						properties: { version: { type: 'number' } },
						required: ['version'],
						additionalProperties: false,
					},
				},
				required: ['meta'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				meta: {
					version: number;
				};
			}
		`);
	});
});
