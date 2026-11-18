import { describe, expect, test } from 'vitest';

import { compileSchema } from '../src';

describe('format hook', () => {
	test('runs a synchronous formatter over generated code', async () => {
		const code = await compileSchema(
			{ type: 'string' },
			{
				cwd: __dirname,
				fileName: 'schema.json',
				format: (generated) => generated.replace('z.string()', 'z.string().min(1)'),
			}
		);

		expect(code).toContain('z.string().min(1)');
	});

	test('supports an asynchronous formatter', async () => {
		const code = await compileSchema(
			{ type: 'string' },
			{
				cwd: __dirname,
				fileName: 'schema.json',
				format: async (generated) => generated.replace('z.string()', 'z.string().max(5)'),
			}
		);

		expect(code).toContain('z.string().max(5)');
	});
});
