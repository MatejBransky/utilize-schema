import { writeFileSync } from 'node:fs';

import { pickDialectOptions } from '@utilize/json-schema';
import type {
	DialectOptions,
	ExternalSchemas,
	JSONSchema,
	ParsedJSONSchema,
} from '@utilize/json-schema';
import {
	bindCompileFile,
	compilePaths,
	generatedFileBanner,
	prependBanner,
	readSchema,
	withParsedSchema,
} from '@utilize/json-schema/node';
import type { CodeFormatter, SchemaFileLocation } from '@utilize/json-schema/node';

import { generate } from './generator';
import type { GenerateOptions } from './generator';
import type { CustomSchemaResolver, FormatMap, FormatMode } from './generators/types';

export interface CompileOptions
	extends
		DialectOptions,
		Pick<GenerateOptions, 'customNameResolver' | 'schemaName' | 'typeName' | 'runtimeImport'> {
	input: string;
	output?: string;
	cwd?: string;
	/** Map `readOnly: true` to `.readonly()`; off by default because it changes the value type. */
	readOnlyKeyword?: boolean;
	/** Maps a `format` to a Zod expression; it applies in both modes, other formats follow `formatMode`. */
	formatMap?: FormatMap;
	/**
	 * What `format` becomes in the generated code: `assert` (default) validates
	 * known formats (`.email()`, …), `annotate` keeps `format` as
	 * `.meta({ format })`.
	 */
	formatMode?: FormatMode;
	/** Emits a caller-provided Zod expression for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/** Runs a formatter (for example Prettier) over the generated code. */
	format?: CodeFormatter | false;
	/** Header prepended to the generated file. Pass `false` to omit it. */
	bannerComment?: string | false;
	/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
	externalSchemas?: ExternalSchemas;
}

export interface CompileSchemaOptions
	extends
		DialectOptions,
		Pick<GenerateOptions, 'customNameResolver' | 'schemaName' | 'typeName' | 'runtimeImport'> {
	cwd: string;
	fileName: string;
	readOnlyKeyword?: boolean;
	formatMap?: FormatMap;
	formatMode?: FormatMode;
	customSchemaResolver?: CustomSchemaResolver;
	format?: CodeFormatter | false;
	/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
	externalSchemas?: ExternalSchemas;
}

export { type CodeFormatter, readSchema };

const defaultCwd = process.cwd();

export const DEFAULT_BANNER = generatedFileBanner('@utilize/zod');

/** Compiles a Zod schema source file to generated code without writing anything. */
export const compileFile = bindCompileFile(compileSchema);

export async function compile(userOptions: CompileOptions) {
	const { inputPath, outputPath } = compilePaths(userOptions, defaultCwd);

	const code = await compileFile(inputPath, {
		customNameResolver: userOptions.customNameResolver,
		schemaName: userOptions.schemaName,
		typeName: userOptions.typeName,
		readOnlyKeyword: userOptions.readOnlyKeyword,
		formatMap: userOptions.formatMap,
		formatMode: userOptions.formatMode,
		customSchemaResolver: userOptions.customSchemaResolver,
		runtimeImport: userOptions.runtimeImport,
		format: userOptions.format,
		externalSchemas: userOptions.externalSchemas,
		...pickDialectOptions(userOptions),
	});

	writeFileSync(outputPath, withBanner(code, userOptions.bannerComment), 'utf8');
}

/** Compiles an already parsed JSON Schema value to generated code. */
export async function compileSchema(
	schema: JSONSchema | boolean,
	options: Partial<CompileSchemaOptions> & SchemaFileLocation
) {
	return await withParsedSchema(schema, options, renderZodModule);
}

function renderZodModule(
	root: ParsedJSONSchema,
	options: Partial<CompileSchemaOptions> & SchemaFileLocation
): string | Promise<string> {
	const code = generate(root, {
		customNameResolver: options.customNameResolver,
		schemaName: options.schemaName,
		typeName: options.typeName,
		readOnlyKeyword: options.readOnlyKeyword,
		formatMap: options.formatMap,
		formatMode: options.formatMode,
		customSchemaResolver: options.customSchemaResolver,
		runtimeImport: options.runtimeImport,
	});

	return options.format ? options.format(code) : code;
}

export function withBanner(code: string, bannerComment?: string | false) {
	return prependBanner(code, bannerComment, DEFAULT_BANNER);
}
