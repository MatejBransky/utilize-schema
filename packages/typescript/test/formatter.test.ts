import { describe, expect, test } from 'vitest';

import { compileSchema } from '../src';

describe('format hook', () => {
	test('runs a synchronous formatter over generated code', async () => {
		const code = await compileSchema(
			{ type: 'string' },
			{
				cwd: __dirname,
				fileName: 'Root.json',
				format: (generated) =>
					generated.replace(
						'export type Root = string;',
						'export type Root = string & { __brand: true };'
					),
			}
		);

		expect(code).toContain('__brand');
	});

	test('supports an asynchronous formatter', async () => {
		const code = await compileSchema(
			{ type: 'string' },
			{
				cwd: __dirname,
				fileName: 'Root.json',
				format: async (generated) => generated.trim(),
			}
		);

		expect(code.trim()).toBe('export type Root = string;');
	});
});
