import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

interface LiteralCase {
	file: string;
	schema: JSONSchema;
	assertions: string;
}

const cases: LiteralCase[] = [
	{
		file: 'ConstObject.ts',
		schema: { title: 'Config', const: { mode: 'dark', sizes: [1, 2] } },
		assertions: `
const ok: Config = { mode: 'dark', sizes: [1, 2] };
// @ts-expect-error mode is a literal
const badMode: Config = { mode: 'light', sizes: [1, 2] };
// @ts-expect-error sizes is the exact tuple
const badSizes: Config = { mode: 'dark', sizes: [1, 3] };
void ok;
void badMode;
void badSizes;
`,
	},
	{
		file: 'ConstArray.ts',
		schema: { title: 'Pair', const: [1, 2] },
		assertions: `
const ok: Pair = [1, 2];
// @ts-expect-error the tuple has exactly two items
const badLength: Pair = [1, 2, 3];
// @ts-expect-error the items are literal
const badItem: Pair = [1, 3];
void ok;
void badLength;
void badItem;
`,
	},
	{
		file: 'OneOf.ts',
		schema: { title: 'Value', oneOf: [{ type: 'string' }, { type: 'number' }] },
		assertions: `
const text: Value = 'a';
const number: Value = 1;
// @ts-expect-error the union is string | number
const flag: Value = true;
void text;
void number;
void flag;
`,
	},
	{
		file: 'EnumComposite.ts',
		schema: { title: 'Mode', enum: [{ kind: 'a' }, [1, 2], 'plain'] },
		assertions: `
const okObject: Mode = { kind: 'a' };
const okArray: Mode = [1, 2];
const okString: Mode = 'plain';
// @ts-expect-error object shape differs
const badObject: Mode = { kind: 'b' };
// @ts-expect-error tuple differs
const badArray: Mode = [1, 3];
void okObject;
void okArray;
void okString;
void badObject;
void badArray;
`,
	},
];

describe('composite literals', () => {
	test('infer the literal value type', async () => {
		const directory = await mkdtemp(join(__dirname, '__generated__-'));
		const files: string[] = [];

		try {
			for (const literalCase of cases) {
				const code = await compile(literalCase.schema, { importZod: true });
				const file = join(directory, literalCase.file);
				await writeFile(file, `${code}\n${literalCase.assertions}`);
				files.push(file);
			}

			expect(() =>
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
				)
			).not.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
