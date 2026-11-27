import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('code generation of enum and const edge cases', () => {
	test('intersects an enum with a parent that has another type keyword', async () => {
		await expect(
			compile({
				type: 'string',
				enum: ['a'],
				properties: { x: { type: 'number' } },
			})
		).toMatchCode(ts`
			export type Root = 'a' & string;
		`);
	});

	test('filters null and integer enum values by the declared type', async () => {
		await expect(compile({ type: 'null', enum: [null] })).toMatchCode(ts`
			export type Root = null;
		`);

		await expect(compile({ type: 'integer', enum: [1, 1.5] })).toMatchCode(ts`
			export type Root = 1;
		`);
	});

	test('escapes string literals', async () => {
		await expect(compile({ enum: ["it's", String.raw`a\b`, 'say "hi"'] })).toMatchCode(ts`
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

	test('intersects const and enum with the declared type', async () => {
		await expect(compile({ type: 'string', enum: ['ok', 42] })).toMatchCode(ts`
			export type Root = 'ok';
		`);

		await expect(compile({ type: 'string', const: 42 })).toMatchCode(ts`
			export type Root = never;
		`);

		await expect(compile({ type: 'number', enum: [1, 'one'] })).toMatchCode(ts`
			export type Root = 1;
		`);
	});
});
