import { expectDefined, parse } from '@utilize/json-schema';
import type { DialectOptions, JSONSchema, NameMapper } from '@utilize/json-schema';
import { Schema } from 'effect';
import { formatSource, ts } from '@utilize/test-utils/code';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generate } from '../src/generator';
import type { CustomSchemaResolver, FormatMode } from '../src/generator';

/** JSON Schema 2020-12 keywords that the draft-07 based `JSONSchema` type lacks. */
export type TestSchema = JSONSchema & {
	prefixItems?: JSONSchema[];
	minContains?: number;
	maxContains?: number;
	unevaluatedProperties?: boolean | JSONSchema;
	unevaluatedItems?: boolean | JSONSchema;
	dependentRequired?: Record<string, string[]>;
	dependentSchemas?: Record<string, JSONSchema>;
};

export type GeneratedSchema = Parameters<typeof Schema.decodeUnknownSync>[0];

export { ts };

export interface CompileOptions extends DialectOptions {
	importEffect?: boolean;
	fileName?: string;
	schemaName?: NameMapper;
	typeName?: NameMapper;
	formatMode?: FormatMode;
	customSchemaResolver?: CustomSchemaResolver;
}

export async function compile(schema: TestSchema, options: CompileOptions = {}) {
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: options.fileName ?? 'Root.json',
		dialect: options.dialect,
		fallbackDialect: options.fallbackDialect,
		unknownDialect: options.unknownDialect,
		keywordPolicy: options.keywordPolicy,
		onDialectIssue: options.onDialectIssue,
	});
	const code = generate(parsed.root, {
		importEffect: options.importEffect ?? false,
		schemaName: options.schemaName,
		typeName: options.typeName,
		formatMode: options.formatMode,
		customSchemaResolver: options.customSchemaResolver,
	});

	return formatSource(code);
}

/**
 * Compiles the schema, runs the generated module and returns its schemas. The
 * module is written next to the tests, so `effect` resolves from this package,
 * and removed after it is loaded.
 */
export async function compileModule(
	schema: TestSchema,
	options?: CompileOptions
): Promise<Record<string, GeneratedSchema>> {
	const code = await compile(schema, { ...options, importEffect: true });
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	try {
		const filePath = join(directory, 'schema.ts');
		await writeFile(filePath, code);
		return (await import(filePath)) as Record<string, GeneratedSchema>;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function compileToSchema(
	schema: TestSchema,
	options?: CompileOptions
): Promise<GeneratedSchema> {
	const module = await compileModule(schema, options);
	return expectDefined(module.Root);
}

/** Returns the decoded value, or `undefined` when decoding fails. */
export function decode<A>(schema: GeneratedSchema, input: unknown): A | undefined {
	try {
		return Schema.decodeUnknownSync(schema)(input) as A;
	} catch {
		return undefined;
	}
}
