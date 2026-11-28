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
import type { InferenceMode } from './render/context';

export interface CompileOptions extends SchemaValidationOptions {
	/** Path of the JSON Schema file, resolved against `cwd`. */
	input: string;
	/** Path of the generated file, resolved against `cwd`. */
	output?: string;
	/** Base directory for `input` and `output`. Defaults to `process.cwd()`. */
	cwd?: string;
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	customSchemaResolver?: CustomSchemaResolver;
	/** `spec` (default) keeps scalar keywords `unknown`; `pragmatic` infers their type. */
	inference?: InferenceMode;
	/** Runs a formatter (for example Prettier) over the generated code. */
	format?: CodeFormatter | false;
	/** Header prepended to the generated file. Pass `false` to omit it. */
	bannerComment?: string | false;
	externalSchemas?: ExternalSchemas;
}

export interface CompileSchemaOptions extends SchemaValidationOptions {
	cwd: string;
	fileName: string;
	customNameResolver?: CustomNameResolver;
	customSchemaResolver?: CustomSchemaResolver;
	inference?: InferenceMode;
	format?: CodeFormatter | false;
	externalSchemas?: ExternalSchemas;
}

export { type CodeFormatter, readSchema };

export const DEFAULT_BANNER = generatedFileBanner('@utilize/typescript');

/** Compiles a JSON or YAML schema source file to generated types without writing anything. */
export const compileFile = bindCompileFile(compileSchema);

/** Reads a schema file, follows its references and writes the generated module. */
export async function compile(options: CompileOptions): Promise<void> {
	const { inputPath, outputPath } = compilePaths(options);

	const code = await compileFile(inputPath, {
		customNameResolver: options.customNameResolver,
		customSchemaResolver: options.customSchemaResolver,
		inference: options.inference,
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
		inference: options.inference,
	});

	return options.format ? options.format(code) : code;
}

export function withBanner(code: string, bannerComment?: string | false) {
	return prependBanner(code, bannerComment, DEFAULT_BANNER);
}
