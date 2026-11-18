import { type JSONSchema } from '@utilize/json-schema';
import { describe, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const filterSchema: JSONSchema = {
	oneOf: [
		{
			type: 'object',
			properties: { type: { const: 'Id' }, search: { type: 'string' } },
			required: ['type', 'search'],
		},
		{
			type: 'object',
			properties: {
				type: { const: 'And' },
				filters: { type: 'array', items: { $ref: '#' } },
			},
			required: ['type', 'filters'],
		},
	],
};

describe('oneOf cycles', () => {
	test('infer a recursive type through the array', async () => {
		const directory = await mkdtemp(join(__dirname, '__generated__-'));
		const file = join(directory, 'Filter.ts');

		try {
			const code = await compile(filterSchema, { importZod: true });
			await writeFile(
				file,
				`${code}
const value: Root = { type: 'And', filters: [{ type: 'Id', search: 'x' }] };

if (value.type === 'And') {
	const first = value.filters[0]!;
	const search: string = first.type === 'Id' ? first.search : '';
	void search;
}

// @ts-expect-error filters contain recursive values, not numbers
const bad: Root = { type: 'And', filters: [1] };
void bad;
`
			);

			try {
				execFileSync(
					process.execPath,
					[
						tsc,
						'--ignoreConfig',
						'--noEmit',
						'--strict',
						'--skipLibCheck',
						'--module',
						'esnext',
						'--moduleResolution',
						'bundler',
						'--target',
						'esnext',
						file,
					],
					{ encoding: 'utf8', stdio: 'pipe' }
				);
			} catch (error) {
				const output = error as { stdout?: string; stderr?: string };

				throw new Error(`tsc failed:\n${output.stdout ?? ''}${output.stderr ?? ''}`, {
					cause: error,
				});
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
