import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('objects', () => {
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
