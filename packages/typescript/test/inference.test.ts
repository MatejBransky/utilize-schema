import { describe, expect, test } from 'vitest';

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compile as compileToFile } from '../src';
import { compile, generateCode, ts } from './test-utils';

describe('inference', () => {
	test('keeps scalar keywords unknown in spec mode', async () => {
		await expect(compile({ format: 'email' })).toMatchCode(ts`
      /**
       * @format email
       */
      export type Root = unknown;
    `);
		expect(await generateCode({ minimum: 3 })).toContain('export type Root = unknown;');
		expect(await generateCode({ contains: { type: 'string' } })).toContain(
			'export type Root = unknown;'
		);
	});

	test('reads format as string in pragmatic mode', async () => {
		await expect(compile({ format: 'email' }, { inference: 'pragmatic' })).toMatchCode(ts`
        /**
         * @format email
         */
        export type Root = string;
      `);
	});

	test('reads numeric and array keyword families in pragmatic mode', async () => {
		expect(await generateCode({ minimum: 3 }, { inference: 'pragmatic' })).toContain(
			'export type Root = number;'
		);
		expect(
			await generateCode({ contains: { type: 'string' } }, { inference: 'pragmatic' })
		).toContain('export type Root = Array<');
	});

	test('does not override an inferred object shape', async () => {
		expect(
			await generateCode(
				{ format: 'email', properties: { id: { type: 'string' } } },
				{ inference: 'pragmatic' }
			)
		).toContain('export interface Root');
	});

	test('does not override an inferred array shape', async () => {
		expect(
			await generateCode({ format: 'email', items: { type: 'string' } }, { inference: 'pragmatic' })
		).toContain('export type Root = Array<string>;');
	});

	test('is passed on by compile()', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-typescript-inference-'));

		try {
			await writeFile(join(directory, 'schema.json'), JSON.stringify({ format: 'email' }));
			await compileToFile({
				input: 'schema.json',
				cwd: directory,
				inference: 'pragmatic',
			});

			expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain(
				'export type Schema = string;'
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
