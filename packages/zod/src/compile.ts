import { parse } from '@utilize/json-schema';
import merge from 'lodash/merge';

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { generate } from './generator';

interface CompileOptions {
	input: string;
	output: string;
	cwd?: string;
}

const defaultOptions = {
	output: path.resolve(process.cwd(), 'schema.generated.ts'),
	cwd: process.cwd(),
} satisfies Omit<CompileOptions, 'name' | 'input'>;

export async function compile(userOptions: CompileOptions) {
	const options = merge({}, defaultOptions, userOptions);

	const inputPath = path.resolve(options.cwd, options.input);
	const outputPath = path.resolve(options.cwd, options.output);
	console.log(`Compiling schema \n from: ${inputPath} \n to: ${outputPath}`);

	const schema = JSON.parse(readFileSync(inputPath, 'utf8'));
	console.log('Schema read from file');

	const { root, referencedSchemas } = await parse(schema, {
		cwd: path.dirname(inputPath),
		fileName: path.basename(inputPath),
	});
	console.log(`Parsed ${referencedSchemas.length + 1} schemas`);

	const code = generate(root);
	console.log(`Generated code`);

	writeFileSync(outputPath, code, 'utf8');
	console.log(`Schema compiled to ${outputPath}`);
}
