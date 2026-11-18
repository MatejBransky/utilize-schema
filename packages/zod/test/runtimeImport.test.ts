import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { join } from 'node:path';

import { run } from '../src/cli';
import { compileSchema } from '../src/compile';
import { compile, compileToZod, ts } from './test-utils';

const overlappingOneOf: JSONSchema = {
	oneOf: [{ type: 'string' }, { type: 'string', maxLength: 3 }],
};

describe('runtimeImport', () => {
	test('imports the oneOf helper instead of declaring it', async () => {
		await expect(compile(overlappingOneOf, { runtimeImport: '@utilize/zod/runtime' }))
			.toMatchCode(ts`
			import { oneOfSchema } from '@utilize/zod/runtime';

			export const Root = oneOfSchema([z.string(), z.string().max(3)]);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('adds no import when no schema needs the helper', async () => {
		await expect(compile({ type: 'string' }, { runtimeImport: '@utilize/zod/runtime' }))
			.toMatchCode(ts`
			export const Root = z.string();
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('the imported helper still requires exactly one matching branch', async () => {
		const Root = await compileToZod(overlappingOneOf, {
			runtimeImport: join(__dirname, '../src/runtime.ts'),
		});

		expect(Root.safeParse('long').success).toBe(true);
		expect(Root.safeParse('abc').success).toBe(false);
		expect(Root.safeParse(42).success).toBe(false);
	});

	test('compileSchema passes the option on', async () => {
		const code = await compileSchema(overlappingOneOf, {
			cwd: __dirname,
			fileName: 'Root.json',
			runtimeImport: '@utilize/zod/runtime',
		});

		expect(code).toContain("import { oneOfSchema } from '@utilize/zod/runtime';");
		expect(code).not.toContain('function oneOfSchema');
	});

	test('the CLI reads --runtime-import', async () => {
		const stdout: string[] = [];
		const exitCode = await run(['--runtime-import', '@utilize/zod/runtime'], {
			stdout: { write: (chunk) => stdout.push(chunk) },
			stderr: { write: () => {} },
			stdin: JSON.stringify(overlappingOneOf),
		});

		expect(exitCode).toBe(0);
		expect(stdout.join('')).toContain("import { oneOfSchema } from '@utilize/zod/runtime';");
		expect(stdout.join('')).not.toContain('function oneOfSchema');
	});
});
