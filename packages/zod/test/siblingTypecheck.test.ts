import type { JSONSchema } from '@utilize/json-schema';
import { describe, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { errorOutput, generateCode } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const recursiveSiblingSchema: JSONSchema = {
	type: 'object',
	properties: {
		child: {
			allOf: [{ $ref: '#' }],
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name'],
		},
	},
};

describe('sibling keywords in value types', () => {
	test('include sibling constraints in a recursive alias', async () => {
		const directory = await mkdtemp(join(__dirname, '__generated__-'));
		const file = join(directory, 'RecursiveSibling.ts');

		try {
			const code = await generateCode(recursiveSiblingSchema, { importZod: true });
			await writeFile(
				file,
				`${code}
const ok: Root = { child: { name: 'x' } };
// @ts-expect-error the runtime intersection requires child.name
const bad: Root = { child: {} };
void ok;
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
				const output = errorOutput(error);

				throw new Error(`tsc failed:\n${output.stdout ?? ''}${output.stderr ?? ''}`, {
					cause: error,
				});
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
