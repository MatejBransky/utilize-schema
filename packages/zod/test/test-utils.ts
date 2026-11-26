import { expectDefined, parse } from '@utilize/json-schema';
import type { DialectOptions, JSONSchema } from '@utilize/json-schema';
import type { z } from 'zod';

import { formatSource, ts } from '@utilize/test-utils/code';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generate } from '../src/generator';
import type { GenerateOptions } from '../src/generator';
import type { CustomSchemaResolver, FormatMap, FormatMode } from '../src/generators/types';

/** Generator options a test can override; the rest keep their test defaults. */
export type TestGenerateOptions = Pick<
	GenerateOptions,
	'schemaName' | 'typeName' | 'runtimeImport'
>;

export { ts };

export interface TestCompileOptions extends TestGenerateOptions {
	importZod?: boolean;
	cwd?: string;
	fileName?: string;
	readOnlyKeyword?: boolean;
	formatMap?: FormatMap;
	formatMode?: FormatMode;
	customSchemaResolver?: CustomSchemaResolver;
}

export async function generateCode(
	schema: JSONSchema,
	options?: TestCompileOptions & DialectOptions
) {
	const parsed = await parse(schema, {
		cwd: options?.cwd ?? __dirname + '/',
		fileName: options?.fileName ?? 'Root.json',
		dialect: options?.dialect,
		fallbackDialect: options?.fallbackDialect,
		unknownDialect: options?.unknownDialect,
		keywordPolicy: options?.keywordPolicy,
		onDialectIssue: options?.onDialectIssue,
	});
	const code = generate(parsed.root, {
		importZod: options?.importZod ?? false,
		readOnlyKeyword: options?.readOnlyKeyword,
		schemaName: options?.schemaName,
		typeName: options?.typeName,
		formatMap: options?.formatMap,
		formatMode: options?.formatMode,
		customSchemaResolver: options?.customSchemaResolver,
		runtimeImport: options?.runtimeImport,
	});
	return formatSource(code);
}

/**
 * Compiles the schema, runs the generated module and returns its `Root` zod
 * schema. The module is written next to the tests, so `zod` resolves from
 * this package, and removed after it is loaded.
 */
export async function compileModule(
	schema: JSONSchema,
	options?: TestCompileOptions & DialectOptions
): Promise<Record<string, z.ZodType>> {
	const code = await generateCode(schema, { ...options, importZod: true });
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	try {
		const filePath = join(directory, 'schema.ts');
		await writeFile(filePath, code);
		return (await import(filePath)) as Record<string, z.ZodType>;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function compileToZod(
	schema: JSONSchema,
	options?: TestCompileOptions & DialectOptions
): Promise<z.ZodType> {
	const module = await compileModule(schema, options);
	return expectDefined(module.Root);
}
