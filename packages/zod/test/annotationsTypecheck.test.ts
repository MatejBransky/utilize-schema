import { type JSONSchema } from '@utilize/json-schema';
import { describe, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const readOnlySchema: JSONSchema = {
	type: 'object',
	readOnly: true,
	properties: { id: { type: 'string' } },
	required: ['id'],
};

const unevaluatedSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { name: { type: 'string' } },
	unevaluatedProperties: false,
} as unknown as JSONSchema;

const cases = [
	{
		file: 'ReadOnly.ts',
		schema: readOnlySchema,
		options: { readOnlyKeyword: true },
		assertions: `
const ok: Root = { id: 'x' };
// @ts-expect-error the whole object is readonly
ok.id = 'y';
void ok;
`,
	},
	{
		file: 'RecursiveReadOnly.ts',
		schema: { type: 'array', readOnly: true, items: { $ref: '#' } } as JSONSchema,
		options: { readOnlyKeyword: true },
		assertions: `
const empty: Root = [];
void empty;
`,
	},
	{
		file: 'NullableReadOnly.ts',
		schema: {
			type: ['object', 'null'],
			readOnly: true,
			properties: { id: { type: 'string' } },
			required: ['id'],
		} as JSONSchema,
		options: { readOnlyKeyword: true },
		assertions: `
const ok: Root = { id: 'x' };
const none: Root = null;
// @ts-expect-error the object branch is readonly
if (ok) ok.id = 'y';
void none;
`,
	},
	{
		file: 'RecursiveNullableReadOnly.ts',
		schema: {
			type: ['object', 'null'],
			readOnly: true,
			properties: { next: { $ref: '#' } },
		} as JSONSchema,
		options: { readOnlyKeyword: true },
		assertions: `
const chain: Root = { next: { next: null } };
// @ts-expect-error the object branch is readonly
if (chain) chain.next = null;
`,
	},
	{
		file: 'Unevaluated.ts',
		schema: unevaluatedSchema,
		options: {},
		assertions: `
const ok: Root = { name: 'x' };
// @ts-expect-error the object is closed
const bad: Root = { name: 'x', extra: 1 };
void ok;
void bad;
`,
	},
];

describe('annotations', () => {
	test('keep their meaning in the inferred types', async () => {
		const directory = await mkdtemp(join(__dirname, '__generated__-'));
		const files: string[] = [];

		try {
			for (const annotationCase of cases) {
				const code = await compile(annotationCase.schema, {
					importZod: true,
					...annotationCase.options,
				});
				const file = join(directory, annotationCase.file);
				await writeFile(file, `${code}\n${annotationCase.assertions}`);
				files.push(file);
			}

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
						...files,
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
