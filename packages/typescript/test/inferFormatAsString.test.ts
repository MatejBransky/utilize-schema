import { describe, expect, test } from 'vitest';

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compile as compileToFile } from '../src';
import { compile, generateCode, ts } from './test-utils';

describe('inferFormatAsString', () => {
	test('keeps a format-only schema unknown by default', async () => {
		await expect(compile({ format: 'email' })).toMatchCode(ts`
      /**
       * @format email
       */
      export type Root = unknown;
    `);
	});

	test('treats a format-only schema as string when enabled', async () => {
		await expect(compile({ format: 'email' }, { inferFormatAsString: true })).toMatchCode(ts`
        /**
         * @format email
         */
        export type Root = string;
      `);
	});

	test('does not override an inferred object shape', async () => {
		expect(
			await generateCode(
				{ format: 'email', properties: { id: { type: 'string' } } },
				{ inferFormatAsString: true }
			)
		).toContain('export interface Root');
	});

	test('does not override an inferred array shape', async () => {
		expect(
			await generateCode(
				{ format: 'email', items: { type: 'string' } },
				{ inferFormatAsString: true }
			)
		).toContain('export type Root = Array<string>;');
	});

	test('is passed on by compile()', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-typescript-format-'));

		try {
			await writeFile(join(directory, 'schema.json'), JSON.stringify({ format: 'email' }));
			await compileToFile({
				input: 'schema.json',
				cwd: directory,
				inferFormatAsString: true,
			});

			expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
				'export type Schema = string;'
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
