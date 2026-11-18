import { describe, expect, test } from 'vitest';

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compile as compileToFile } from '../src';
import { compile, ts } from './test-utils';

describe('customSchemaResolver', () => {
	test('replaces a matching property with a custom TypeScript type', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { created: { type: 'string', format: 'date-time' } },
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) => (schema.format === 'date-time' ? 'Date' : undefined),
				}
			)
		).toMatchCode(ts`
      export interface Root {
        /**
         * @format date-time
         */
        created: Date;
        [key: string]: unknown;
      }
    `);
	});

	test('lets the resolver replace the root declaration instead of an interface', async () => {
		await expect(
			compile(
				{ type: 'object', title: 'Money', properties: { amount: { type: 'number' } } },
				{ customSchemaResolver: (schema) => (schema.title === 'Money' ? 'string' : undefined) }
			)
		).toMatchCode(ts`
      export type Money = string;
    `);
	});

	test('leaves unmatched nodes to the generator', async () => {
		await expect(compile({ type: 'string' }, { customSchemaResolver: () => undefined }))
			.toMatchCode(ts`
      export type Root = string;
    `);
	});

	test('is passed on by compile()', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-typescript-resolver-'));

		try {
			await writeFile(
				join(directory, 'schema.json'),
				JSON.stringify({ type: 'string', format: 'date-time' })
			);
			await compileToFile({
				input: 'schema.json',
				cwd: directory,
				customSchemaResolver: (schema) => (schema.format === 'date-time' ? 'Date' : undefined),
			});

			expect(await readFile(join(directory, 'schema.generated.ts'), 'utf8')).toContain('Date');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
