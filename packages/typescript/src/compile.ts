import { writeFileSync } from 'node:fs';

import { parse } from '@utilize/json-schema';
import type {
	CustomNameResolver,
	ExternalSchemas,
	JSONSchema,
	SchemaValidationOptions,
} from '@utilize/json-schema';

import {
	bindCompileFile,
	compilePaths,
	generatedFileBanner,
	prependBanner,
	readSchema,
} from '@utilize/json-schema/node';
import type { CodeFormatter, SchemaFileLocation } from '@utilize/json-schema/node';

import { generate } from './generator';
import type { CustomSchemaResolver } from './generator';

export interface CompileOptions extends SchemaValidationOptions {
	/** Path of the JSON Schema file, resolved against `cwd`. */
	input: string;
	/** Path of the generated file, resolved against `cwd`. */
	output?: string;
	/** Base directory for `input` and `output`. Defaults to `process.cwd()`. */
	cwd?: string;
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Emits a caller-provided TypeScript type for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/**
	 * Treats a schema that would otherwise be `unknown` and has `format` as
	 * `string`. Off by default because `format` only applies to strings;
	 * non-string instances stay valid without `type`.
	 */
	inferFormatAsString?: boolean;
	/** Runs a formatter (for example Prettier) over the generated code. */
	format?: CodeFormatter | false;
	/** Header prepended to the generated file. Pass `false` to omit it. */
	bannerComment?: string | false;
	/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
	externalSchemas?: ExternalSchemas;
}

export interface CompileSchemaOptions extends SchemaValidationOptions {
	cwd: string;
	fileName: string;
	customNameResolver?: CustomNameResolver;
	customSchemaResolver?: CustomSchemaResolver;
	inferFormatAsString?: boolean;
	format?: CodeFormatter | false;
	/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
	externalSchemas?: ExternalSchemas;
}

export { type CodeFormatter, readSchema };

export const DEFAULT_BANNER = generatedFileBanner('@utilize/typescript');

/** Compiles a JSON or YAML schema source file to generated types without writing anything. */
export const compileFile = bindCompileFile(compileSchema);

/**
 * Reads a JSON or YAML schema file, follows its references and writes the
 * generated TypeScript type module next to it.
 */
export async function compile(options: CompileOptions): Promise<void> {
	const { inputPath, outputPath } = compilePaths(options);

	const code = await compileFile(inputPath, {
		customNameResolver: options.customNameResolver,
		customSchemaResolver: options.customSchemaResolver,
		inferFormatAsString: options.inferFormatAsString,
		format: options.format,
		externalSchemas: options.externalSchemas,
		validateSchema: options.validateSchema,
	});

	writeFileSync(outputPath, withBanner(code, options.bannerComment), 'utf8');
}

/** Compiles an already parsed JSON Schema value to generated code. */
export async function compileSchema(
	schema: JSONSchema | boolean,
	options: Partial<CompileSchemaOptions> & SchemaFileLocation
) {
	const { root } = await parse(schema, {
		cwd: options.cwd,
		fileName: options.fileName,
		externalSchemas: options.externalSchemas,
		validateSchema: options.validateSchema,
	});

	const code = generate(root, {
		customNameResolver: options.customNameResolver,
		customSchemaResolver: options.customSchemaResolver,
		inferFormatAsString: options.inferFormatAsString,
	});

	return options.format ? options.format(code) : code;
}

export function withBanner(code: string, bannerComment?: string | false) {
	return prependBanner(code, bannerComment, DEFAULT_BANNER);
}
