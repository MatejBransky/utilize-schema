import { describe, expect, test } from 'vitest';

import { compileSchema } from '../src';

describe('format hook', () => {
	test('runs a synchronous formatter over generated code', async () => {
		const code = await compileSchema(
			{ type: 'string' },
			{
				cwd: __dirname,
				fileName: 'Root.json',
				format: (generated) => generated.replace('Schema.String', 'Schema.NonEmptyString'),
			}
		);

		expect(code).toContain('Schema.NonEmptyString');
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

		expect(code.trim()).toMatch(/export type Root = typeof Root.Type;$/);
	});
});
