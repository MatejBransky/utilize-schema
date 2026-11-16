import { describe, expect, test } from 'vitest';

import { compile, compileModule, decode, ts } from './test-utils';

describe('annotations', () => {
	test('title names the schema and is kept as an annotation', async () => {
		const result = await compile({ type: 'string', title: 'Test Title' });

		await expect(result).toMatchCode(ts`
			export const TestTitle = Schema.String.annotate({ title: 'Test Title' });

			export type TestTitle = typeof TestTitle.Type;
		`);
	});

	test('description on an untyped schema', async () => {
		const result = await compile({ description: 'This is a test description' });

		await expect(result).toMatchCode(ts`
			export const Root = Schema.Json.annotate({ description: 'This is a test description' });

			export type Root = typeof Root.Type;
		`);
	});

	test('default is an annotation, not a decoding default', async () => {
		const module = await compileModule({
			type: 'object',
			properties: { theme: { type: 'string', default: 'auto' } },
		});

		await expect(decode(module.Root!, {})).toEqual({});
		expect(decode(module.Root!, { theme: 'dark' })).toEqual({ theme: 'dark' });
	});

	test('examples, $id, format and readOnly are annotations', async () => {
		const result = await compile({
			type: 'string',
			$id: 'https://example.com/name',
			examples: ['Jane'],
			format: 'email',
			readOnly: true,
			writeOnly: false,
		});

		await expect(result).toMatchCode(ts`
			export const Name = Schema.String.annotate({
				examples: ['Jane'],
				identifier: 'https://example.com/name',
				format: 'email',
				readOnly: true,
				writeOnly: false,
			});

			export type Name = typeof Name.Type;
		`);
	});
});
