import {
	expectDefined,
	isParsedJSONSchemaObject,
	Meta,
	parse,
	resolveDialect,
} from '@utilize/json-schema';
import type { DialectOptions, JSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
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

/** Adds raw keywords the public model does not declare yet to a typed fixture. */
export function schemaWithExtensions(
	schema: JSONSchema,
	extensions: Record<string, unknown>
): JSONSchema {
	return Object.assign(schema, extensions);
}

/** Builds the linked shape unit tests need without running the parser. */
export function parsedSchema(schema: JSONSchema): ParsedJSONSchemaObject {
	Object.defineProperty(schema, Meta, {
		configurable: true,
		value: {
			fileName: 'test.json',
			filePath: __dirname,
			path: [],
			parent: null,
			dialect: resolveDialect({}).dialect.id,
			dialectSource: 'fallback',
		},
	});

	if (!isParsedJSONSchemaObject(schema)) {
		throw new Error('Fixture did not become a parsed schema.');
	}

	return schema;
}

export interface ProcessFailure {
	stdout?: string;
	stderr?: string;
}

function isProcessFailure(value: unknown): value is ProcessFailure {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if ('stdout' in value && typeof value.stdout !== 'string') {
		return false;
	}

	if ('stderr' in value && typeof value.stderr !== 'string') {
		return false;
	}

	return true;
}

/** Reads the optional captured output from a failed child process. */
export function errorOutput(error: unknown): ProcessFailure {
	return isProcessFailure(error) ? error : {};
}

function isZodType(value: unknown): value is z.ZodType {
	return (
		typeof value === 'object' &&
		value !== null &&
		'safeParse' in value &&
		typeof value.safeParse === 'function'
	);
}

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
		const loaded: unknown = await import(filePath);

		if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
			throw new Error('Generated module did not evaluate to an object.');
		}

		const module: Record<string, z.ZodType> = {};

		for (const [name, value] of Object.entries(loaded)) {
			if (!isZodType(value)) {
				throw new Error(`Generated export "${name}" is not a Zod schema.`);
			}

			module[name] = value;
		}

		return module;
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
