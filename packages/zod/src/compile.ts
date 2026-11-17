import { parse } from '@utilize/json-schema';

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { generate } from './generator';
import type { CustomNameResolver } from './resolveName';

export interface CompileOptions {
	input: string;
	output?: string;
	cwd?: string;
	customNameResolver?: CustomNameResolver;
	/** Map `readOnly: true` to `.readonly()`; off by default because it changes the value type. */
	readOnlyKeyword?: boolean;
}

const defaultCwd = process.cwd();

export async function compile(userOptions: CompileOptions) {
	const cwd = userOptions.cwd ?? defaultCwd;
	const inputPath = path.resolve(cwd, userOptions.input);
	const outputPath = path.resolve(cwd, userOptions.output ?? 'schema.generated.ts');
	console.log(`Compiling schema \n from: ${inputPath} \n to: ${outputPath}`);

	const schema = JSON.parse(readFileSync(inputPath, 'utf8'));
	console.log('Schema read from file');

	const { root, referencedSchemas } = await parse(schema, {
		cwd: path.dirname(inputPath),
		fileName: path.basename(inputPath),
	});
	console.log(`Parsed ${referencedSchemas.length + 1} schemas`);

	const code = generate(root, {
		customNameResolver: userOptions.customNameResolver,
		readOnlyKeyword: userOptions.readOnlyKeyword,
	});
	console.log(`Generated code`);

	writeFileSync(outputPath, code, 'utf8');
	console.log(`Schema compiled to ${outputPath}`);
}
