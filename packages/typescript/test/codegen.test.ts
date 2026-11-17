import { describe, expect, test } from 'vitest';

import { generate } from '../src/generator';
import { compile, ts, type TestSchema } from './test-utils';

describe('code generation', () => {
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

	test('escapes string literals', async () => {
		await expect(compile({ enum: ["it's", 'a\\b', 'say "hi"'] })).toMatchCode(ts`
			export type Root = 'it\'s' | 'a\\b' | 'say "hi"';
		`);
	});

	test('renders object and array const values as literal types', async () => {
		await expect(
			compile({
				const: { kind: 'point', values: [1, 2] },
			})
		).toMatchCode(ts`
			export type Root = { kind: 'point'; values: [1, 2] };
		`);
	});

	test('maps a union of types', async () => {
		await expect(compile({ type: ['string', 'null'] })).toMatchCode(ts`
			export type Root = string | null;
		`);
	});

	test('infers the value type from keywords when `type` is missing', async () => {
		await expect(compile({ properties: { name: { type: 'string' } }, required: ['name'] }))
			.toMatchCode(ts`
			export interface Root {
				name: string;
				[key: string]: unknown;
			}
		`);

		await expect(compile({ minLength: 2 })).toMatchCode(ts`
			export type Root = string;
		`);

		await expect(compile({ items: { type: 'number' } })).toMatchCode(ts`
			export type Root = Array<number>;
		`);

		await expect(compile({})).toMatchCode(ts`
			export type Root = unknown;
		`);
	});

	test('renders boolean schemas', () => {
		expect(generate(true)).toBe('export type Root = unknown;\n');
		expect(generate(false)).toBe('export type Root = never;\n');
	});
});
