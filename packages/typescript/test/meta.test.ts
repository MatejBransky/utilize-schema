import { describe, expect, test } from 'vitest';

import { compile, ts, type TestSchema } from './test-utils';

describe('annotations', () => {
	test('renders a declaration JSDoc from title and description', async () => {
		await expect(
			compile({
				type: 'object',
				title: 'Person',
				description: 'A person record.',
				properties: { name: { type: 'string' } },
				deprecated: true,
				additionalProperties: false,
			})
		).toMatchCode(ts`
			/**
			 * A person record.
			 *
			 * @deprecated
			 */
			export interface Person {
				name?: string;
			}
		`);
	});

	test('omits a title that only repeats the declaration name', async () => {
		await expect(
			compile({
				title: 'Cycle A',
				type: 'object',
				properties: { name: { type: 'string' } },
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface CycleA {
				name?: string;
			}
		`);
	});

	test('keeps a title that adds information beyond the declaration name', async () => {
		await expect(
			compile(
				{
					title: 'A person record.',
					type: 'object',
					properties: { name: { type: 'string' } },
					additionalProperties: false,
				},
				{ customNameResolver: () => 'Person' }
			)
		).toMatchCode(ts`
			/**
			 * A person record.
			 */
			export interface Person {
				name?: string;
			}
		`);
	});

	test('renders property JSDoc with annotations', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					email: {
						type: 'string',
						title: 'Email',
						description: 'The address we send mail to.',
						format: 'email',
						default: 'jane@example.com',
						examples: ['john@example.com'],
					},
					status: { type: 'string', deprecated: true } as TestSchema,
				},
				required: ['email'],
				additionalProperties: false,
			})
		).toMatchCode(ts`
			export interface Root {
				/**
				 * Email
				 * The address we send mail to.
				 *
				 * @default "jane@example.com"
				 * @format email
				 * @example "john@example.com"
				 */
				email: string;
				/**
				 * @deprecated
				 */
				status?: string;
			}
		`);
	});

	test('keeps multi-line descriptions readable', async () => {
		await expect(
			compile({
				type: 'string',
				description: 'First line.\nSecond line.',
			})
		).toMatchCode(ts`
			/**
			 * First line.
			 * Second line.
			 */
			export type Root = string;
		`);
	});

	test('escapes comment terminators', async () => {
		const code = await compile({ type: 'string', description: 'Ends with */' });

		expect(code).toContain('* Ends with *\\/');
	});

	test('does not emit JSDoc without annotations', async () => {
		await expect(compile({ type: 'string' })).toMatchCode(ts`
			export type Root = string;
		`);
	});
});
