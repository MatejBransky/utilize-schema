import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { type CodeFormatter, compile, compileSchema, DEFAULT_BANNER } from '../src';

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

	test('is passed on by compile() and runs before the banner is prepended', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-typescript-format-'));
		const formatterInputs: string[] = [];
		// Typed with the package export, so dropping the export fails `check:types`.
		const formatter: CodeFormatter = (generated) => {
			formatterInputs.push(generated);
			return '// formatted\n';
		};

		try {
			await writeFile(join(directory, 'schema.json'), JSON.stringify({ type: 'string' }));
			await compile({
				input: 'schema.json',
				cwd: directory,
				format: formatter,
			});

			expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toBe(
				`${DEFAULT_BANNER}// formatted\n`
			);
			expect(formatterInputs).toHaveLength(1);
			expect(formatterInputs[0]).not.toContain('DO NOT MODIFY IT BY HAND');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
