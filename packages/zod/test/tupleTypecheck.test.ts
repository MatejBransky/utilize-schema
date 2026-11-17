import { type JSONSchema } from '@utilize/json-schema';
import { describe, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const pointSchema: JSONSchema = {
	type: 'object',
	properties: {
		point: {
			type: 'array',
			items: [
				{ type: 'integer', minimum: 0 },
				{ type: 'integer', minimum: 0 },
			],
			minItems: 2,
			maxItems: 2,
		},
	},
	required: ['point'],
};

describe('fixed-length tuples', () => {
	test('infer a non-optional tuple', async () => {
		const directory = await mkdtemp(join(__dirname, '__generated__-'));
		const file = join(directory, 'Point.ts');

		try {
			const code = await compile(pointSchema, { importZod: true });
			await writeFile(
				file,
				`${code}
const value: Root = { point: [1, 2] };
const [x, y] = value.point;
const first: number = x;
const second: number = y;
void first;
void second;

// @ts-expect-error the tuple has exactly two items
const missing: Root = { point: [1] };
// @ts-expect-error the tuple has exactly two items
const extra: Root = { point: [1, 2, 3] };
void missing;
void extra;
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
