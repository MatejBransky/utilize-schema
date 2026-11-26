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

		expect(result).not.toContain('a: Schema.Json');
	});

	test('applies $ref siblings in 2020-12', async () => {
		const result = await compile({
			$schema: twentyTwentyTwelve,
			$defs: { A: { type: 'object' } },
			type: 'object',
			properties: { value: { $ref: '#/$defs/A', required: ['a'] } },
		});

		expect(result).toContain('a: Schema.Json');
	});
});
