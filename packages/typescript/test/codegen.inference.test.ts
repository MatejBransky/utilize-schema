import { describe, expect, test } from 'vitest';

import { generate } from '../src/generator';
import { compile, ts } from './test-utils';

describe('code generation of inferred and fallback types', () => {
	test('maps a union of types', async () => {
		await expect(compile({ type: ['string', 'null'] })).toMatchCode(ts`
			export type Root = string | null;
		`);
	});

	test('infers a shape from structural keywords when `type` is missing', async () => {
		await expect(compile({ properties: { name: { type: 'string' } }, required: ['name'] }))
			.toMatchCode(ts`
			export interface Root {
				name: string;
				[key: string]: unknown;
			}
		`);

		await expect(compile({ items: { type: 'number' } })).toMatchCode(ts`
			export type Root = Array<number>;
		`);

		await expect(compile({ required: ['name'] })).toMatchCode(ts`
			export interface Root {
				name: unknown;
				[key: string]: unknown;
			}
		`);
	});

	test('does not infer a type from scalar constraints', async () => {
		// `minLength` only applies to strings, so `{ minLength: 2 }` also accepts
		// numbers and objects. Typing it as `string` would reject valid instances.
		await expect(compile({ minLength: 2 })).toMatchCode(ts`
			export type Root = unknown;
		`);

		await expect(compile({ maximum: 3 })).toMatchCode(ts`
			export type Root = unknown;
		`);
	});

	test('renders an empty schema as unknown', async () => {
		await expect(compile({})).toMatchCode(ts`
			export type Root = unknown;
		`);
	});

	test('renders boolean schemas', () => {
		expect(generate(true)).toBe('export type Root = unknown;\n');
		expect(generate(false)).toBe('export type Root = never;\n');
	});
});
