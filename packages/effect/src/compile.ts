import { writeFileSync } from 'node:fs';

import { pickDialectOptions } from '@utilize/json-schema';
import type {
	DialectOptions,
	ExternalSchemas,
	JSONSchema,
	ParsedJSONSchema,
	SchemaValidationOptions,
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

import type { FormatMode, GenerateOptions } from './context';
import { generate } from './generator';

export interface CompileOptions
	extends
		DialectOptions,
		SchemaValidationOptions,
		Pick<
			GenerateOptions,
			'customNameResolver' | 'customSchemaResolver' | 'schemaName' | 'typeName'
		> {
	/** Path of the JSON Schema file, resolved against `cwd`. */
	input: string;
	/** Path of the generated file, resolved against `cwd`. */
	output?: string;
	/** Base directory for `input` and `output`. Defaults to `process.cwd()`. */
	cwd?: string;
	/** Emit `import { Schema } from 'effect';` at the top of the generated code. */
	importEffect?: boolean;
	/**
	 * What `format` becomes in the generated code: `assert` (default) validates
	 * known formats, `annotate` keeps `format` as `.annotate({ format })`.
	 */
	formatMode?: FormatMode;
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
		SchemaValidationOptions,
		Pick<
			GenerateOptions,
			'customNameResolver' | 'customSchemaResolver' | 'schemaName' | 'typeName'
		> {
	cwd: string;
	fileName: string;
	importEffect?: boolean;
	formatMode?: FormatMode;
	format?: CodeFormatter | false;
	/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
	externalSchemas?: ExternalSchemas;
}

export { type CodeFormatter, readSchema };

export const DEFAULT_BANNER = generatedFileBanner('@utilize/effect');

/** Compiles an Effect Schema source file to generated code without writing anything. */
export const compileFile = bindCompileFile(compileSchema);

/**
 * Reads a JSON or YAML schema file, follows its references and writes the
 * generated Effect Schema module next to it.
 */
export async function compile(options: CompileOptions): Promise<void> {
	const { inputPath, outputPath } = compilePaths(options);

	const code = await compileFile(inputPath, {
		importEffect: options.importEffect,
		customNameResolver: options.customNameResolver,
		schemaName: options.schemaName,
		typeName: options.typeName,
		formatMode: options.formatMode,
		customSchemaResolver: options.customSchemaResolver,
		format: options.format,
		externalSchemas: options.externalSchemas,
		validateSchema: options.validateSchema,
		...pickDialectOptions(options),
	});

	writeFileSync(outputPath, withBanner(code, options.bannerComment), 'utf8');
}

/** Compiles an already parsed JSON Schema value to generated code. */
export async function compileSchema(
	schema: JSONSchema | boolean,
	options: Partial<CompileSchemaOptions> & SchemaFileLocation
) {
	return await withParsedSchema(schema, options, renderEffectModule);
}

function renderEffectModule(
	root: ParsedJSONSchema,
	options: Partial<CompileSchemaOptions> & SchemaFileLocation
): string | Promise<string> {
	const code = generate(root, {
		importEffect: options.importEffect,
		customNameResolver: options.customNameResolver,
		schemaName: options.schemaName,
		typeName: options.typeName,
		formatMode: options.formatMode,
		customSchemaResolver: options.customSchemaResolver,
	});

	return options.format ? options.format(code) : code;
}

export function withBanner(code: string, bannerComment?: string | false) {
	return prependBanner(code, bannerComment, DEFAULT_BANNER);
}
