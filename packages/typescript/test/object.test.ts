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
