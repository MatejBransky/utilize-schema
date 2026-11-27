import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

const tick = '`';
const open = '${string}';
const fooOrBar = "${'foo' | 'bar'}";
const letters = "${'a' | 'b'}";
const digits = "${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'}";

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
			export type Root = { id: string } & {
				[key in ${tick}x-${open}${tick} | ${tick}y-${open}${tick}]?: number | string;
			};
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
			export type Root = { x: string; y: number } & {
				[key in 'x' | ${tick}y${open}${tick}]?: string | number;
			};
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

	test('maps a finite propertyNames enum to a mapped type', async () => {
		await expect(
			compile({
				type: 'object',
				propertyNames: { enum: ['monday', 'tuesday'] },
				additionalProperties: { type: 'number' },
			})
		).toMatchCode(ts`
			export type Root = {
				[key in 'monday' | 'tuesday']?: number;
			};
		`);
	});

	test('uses a referenced enum as the propertyNames key type', async () => {
		await expect(
			compile({
				type: 'object',
				propertyNames: { $ref: '#/$defs/Weekday' },
				additionalProperties: { type: 'number' },
				$defs: {
					Weekday: { type: 'string', enum: ['monday', 'tuesday'] },
				},
			})
		).toMatchCode(ts`
			export type Weekday = 'monday' | 'tuesday';

			export type Root = {
				[key in Weekday]?: number;
			};
		`);
	});

	test('intersects required properties with a mapped key set', async () => {
		await expect(
			compile({
				type: 'object',
				propertyNames: { enum: ['monday', 'tuesday'] },
				properties: { monday: { type: 'number' } },
				required: ['monday'],
				additionalProperties: { type: 'number' },
			})
		).toMatchCode(ts`
			export type Root = {
				monday: number;
			} & {
				[key in 'monday' | 'tuesday']?: number;
			};
		`);
	});

	test('drops propertyNames keys that a closed object does not allow', async () => {
		await expect(
			compile({
				type: 'object',
				propertyNames: { enum: ['x-a', 'y', 'x-b'] },
				patternProperties: { '^x-': { type: 'number' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export type Root = {
				[key in 'x-a' | 'x-b']?: number;
			};
		`);
	});

	test('maps finite pattern alternatives to a template literal key type', async () => {
		await expect(
			compile({
				type: 'object',
				additionalProperties: false,
				patternProperties: {
					'^applies_to_(foo|bar)$': { type: 'string' },
				},
			})
		).toMatchCode(ts`
			export type Root = {
				[key in ${tick}applies_to_${fooOrBar}${tick}]?: string;
			};
		`);
	});

	test('keeps the open side of an unanchored pattern', async () => {
		await expect(
			compile({
				type: 'object',
				additionalProperties: false,
				patternProperties: {
					'applies_to_(foo|bar)': { type: 'string' },
				},
			})
		).toMatchCode(ts`
			export type Root = {
				[key in ${tick}${open}applies_to_${fooOrBar}${open}${tick}]?: string;
			};
		`);
	});

	test('maps anchored prefixes and character classes to key templates', async () => {
		await expect(
			compile({
				type: 'object',
				additionalProperties: false,
				patternProperties: {
					'^x-': { type: 'number' },
					'^[ab]-[0-9]$': { type: 'boolean' },
				},
			})
		).toMatchCode(ts`
			export type Root = {
				[key in ${tick}x-${open}${tick} | ${tick}${letters}-${digits}${tick}]?: number | boolean;
			};
		`);
	});

	test('falls back to an index signature for patterns a type cannot express', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { id: { type: 'string' } },
				required: ['id'],
				patternProperties: { 'f.*o': { type: 'integer' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				id: string;
				[key: string]: number | string;
			}
		`);
	});

	test('renders an empty propertyNames enum as a closed object', async () => {
		await expect(
			compile({
				type: 'object',
				propertyNames: { enum: [] },
				additionalProperties: { type: 'string' },
			})
		).toMatchCode(ts`
			export type Root = {
				[key: string]: never;
			};
		`);
	});

	test('keeps declared properties when a pattern matches no keys', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { id: { type: 'string' } },
				required: ['id'],
				patternProperties: { '^[]$': { type: 'number' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export type Root = {
				id: string;
			};
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
