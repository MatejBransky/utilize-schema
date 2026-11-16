import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parse, type JSONSchema } from '@utilize/json-schema';

import { generate } from './generator';
import type { CustomNameResolver } from './resolveName';

export interface CompileOptions {
	/** Path of the JSON Schema file, resolved against `cwd`. */
	input: string;
	/** Path of the generated file, resolved against `cwd`. */
	output?: string;
	/** Base directory for `input` and `output`. Defaults to `process.cwd()`. */
	cwd?: string;
	/** Emit `import { Schema } from 'effect';` at the top of the generated code. */
	importEffect?: boolean;
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
}

/**
 * Reads a JSON Schema file, follows its references and writes the generated
 * Effect Schema module next to it.
 */
export async function compile(options: CompileOptions): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const inputPath = path.resolve(cwd, options.input);
	const outputPath = path.resolve(cwd, options.output ?? 'schema.generated.ts');

	console.log(`Compiling schema \n from: ${inputPath} \n to: ${outputPath}`);

	const schema = JSON.parse(readFileSync(inputPath, 'utf8')) as JSONSchema;
	console.log('Schema read from file');

	const { root, referencedSchemas } = await parse(schema, {
		cwd: path.dirname(inputPath),
		fileName: path.basename(inputPath),
	});
	console.log(`Parsed ${referencedSchemas.length + 1} schemas`);

	const code = generate(root, {
		importEffect: options.importEffect,
		customNameResolver: options.customNameResolver,
	});
	console.log('Generated code');

	writeFileSync(outputPath, code, 'utf8');
	console.log(`Schema compiled to ${outputPath}`);
}
