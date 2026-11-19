import { describe, expect, test } from 'vitest';

import { compile } from './test-utils';

const twentyTwentyTwelve = 'https://json-schema.org/draft/2020-12/schema';

describe('unsupported keywords', () => {
	test('ignores $ref siblings in draft-07', async () => {
		const result = await compile({
			$defs: { A: { type: 'object' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/A', required: ['a'] } },
		});

		await expect(result).not.toContain('a: Schema.Json');
	});

	test('applies $ref siblings in 2020-12', async () => {
		const result = await compile({
			$schema: twentyTwentyTwelve,
			$defs: { A: { type: 'object' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/A', required: ['a'] } },
		});

		await expect(result).toContain('a: Schema.Json');
	});

	test('rejects allOf branches that declare the same property', async () => {
		await expect(
			compile({
				allOf: [
					{ type: 'object', properties: { a: { type: 'string' } } },
					{ type: 'object', properties: { a: { type: 'number' } } },
				],
			})
		).rejects.toThrow(/declared by more than one subschema/);
	});

	test('rejects allOf branches that are not objects', async () => {
		await expect(compile({ allOf: [{ type: 'string' }] })).rejects.toThrow(
			/only object subschemas can be merged/
		);
	});

	test('rejects non-primitive const values', async () => {
		await expect(compile({ const: { a: 1 } })).rejects.toThrow(
			/only primitive values are supported/
		);
	});
});
