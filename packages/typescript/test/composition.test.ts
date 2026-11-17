import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('composition', () => {
	test('intersects allOf members', async () => {
		await expect(
			compile({
				allOf: [
					{
						type: 'object',
						properties: { a: { type: 'string' } },
						required: ['a'],
						additionalProperties: false,
					},
					{
						type: 'object',
						properties: { b: { type: 'number' } },
						required: ['b'],
						additionalProperties: false,
					},
				],
			})
		).toMatchCode(ts`
			export type Root = {
				a: string;
			} & {
				b: number;
			};
		`);
	});

	test('keeps the declaring keywords of an allOf schema', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { type: 'string' } },
				required: ['a'],
				additionalProperties: false,
				allOf: [
					{
						type: 'object',
						properties: { b: { type: 'number' } },
						required: ['b'],
						additionalProperties: false,
					},
				],
			})
		).toMatchCode(ts`
			export type Root = {
				a: string;
			} & {
				b: number;
			};
		`);
	});

	test('unions anyOf and oneOf members', async () => {
		await expect(compile({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toMatchCode(ts`
			export type Root = string | number;
		`);

		await expect(
			compile({
				oneOf: [
					{ type: 'object', properties: { kind: { const: 'a' } }, required: ['kind'] },
					{ type: 'object', properties: { kind: { const: 'b' } }, required: ['kind'] },
				],
			})
		).toMatchCode(ts`
			export type Root =
				| { kind: 'a'; [key: string]: unknown }
				| { kind: 'b'; [key: string]: unknown };
		`);
	});

	test('renders empty unions as never', async () => {
		await expect(compile({ anyOf: [] })).toMatchCode(ts`
			export type Root = never;
		`);

		await expect(compile({ oneOf: [] })).toMatchCode(ts`
			export type Root = never;
		`);
	});

	test('deduplicates union members', async () => {
		await expect(
			compile({
				anyOf: [
					{ type: 'string', minLength: 1 },
					{ type: 'string', maxLength: 5 },
					{ type: 'null' },
				],
			})
		).toMatchCode(ts`
			export type Root = string | null;
		`);
	});

	test('resolves $ref sibling keywords before generation', async () => {
		// The parser merges a `$ref` with its siblings, so the generator sees a
		// single object schema instead of a reference.
		await expect(
			compile({
				$ref: '#/$defs/Base',
				properties: { extra: { type: 'boolean' } },
				required: ['extra'],
				$defs: {
					Base: {
						type: 'object',
						properties: { id: { type: 'string' } },
						required: ['id'],
						additionalProperties: false,
					},
				},
			})
		).toMatchCode(ts`
			export interface Base {
				id: string;
			}

			export interface Root {
				id?: string;
				extra: boolean;
			}
		`);
	});

	test('keeps annotations next to a $ref', async () => {
		await expect(
			compile({
				$ref: '#/$defs/Base',
				description: 'An alias',
				default: null,
				$defs: {
					Base: { type: 'object', properties: { id: { type: 'string' } } },
				},
			})
		).toMatchCode(ts`
			export interface Base {
				id?: string;
				[key: string]: unknown;
			}

			/**
			 * An alias
			 *
			 * @default null
			 */
			export interface Root {
				id?: string;
				[key: string]: unknown;
			}
		`);
	});

	test('ignores keywords that have no type equivalent', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					country: { type: 'string', pattern: '^[A-Z]{2}$' },
					postal: { type: 'string', minLength: 3 },
					scores: { type: 'array', items: { type: 'number' }, uniqueItems: true },
				},
				required: ['country'],
				dependencies: { country: ['postal'] },
				if: { properties: { country: { const: 'US' } } },
				then: { required: ['postal'] },
				not: { properties: { postal: { const: '00000' } } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				country: string;
				postal?: string;
				scores?: Array<number>;
			}
		`);
	});
});
