import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { compile, compileSchema, DEFAULT_BANNER } from '../src';
import type { CodeFormatter } from '../src';

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
				format: async (generated) => `// formatted asynchronously\n${generated}`,
			}
		);

		expect(code).toMatch(/^\/\/ formatted asynchronously\n/);
	});

	test('keeps the generated code as-is when format is false', async () => {
		const options = { cwd: __dirname, fileName: 'Root.json' };

		expect(await compileSchema({ type: 'string' }, { ...options, format: false })).toBe(
			await compileSchema({ type: 'string' }, options)
		);
	});

	test('is passed on by compile() and runs before the banner is prepended', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-effect-format-'));
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
