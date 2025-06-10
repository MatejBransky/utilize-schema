import {
	dereference,
	type DereferenceOptions,
	type JSONSchema,
	link,
	normalize,
	parse,
	rules,
} from '@utilize/json-schema-core';
import prettierConfig from '@utilize/prettier-config/prettier.json';
import {
	format as prettierFormat,
	type Options as PrettierOptions,
} from 'prettier';

import { generate } from '../src';

export function format(code: string) {
	return prettierFormat(code, {
		...(prettierConfig as PrettierOptions),
		parser: 'typescript',
	});
}

/**
 * A tagged template literal function that formats TypeScript code.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const rawString = String.raw(strings, ...values);
	return format(rawString);
};

interface CompileOptions {
	fileName: string;
	deref: DereferenceOptions;
}

export async function compile(
	schema: JSONSchema,
	options: CompileOptions
): Promise<string> {
	const deref = await dereference(schema, options.deref); // resolved JSONSchema refs
	const linked = link(deref.dereferencedSchema as JSONSchema); // parent link in every schema node
	const normalized = normalize({
		rootSchema: linked,
		dereferencedPaths: deref.dereferencedPaths,
		fileName: options.fileName,
		rules,
	}); // unified JSON Schema various functions
	const ast = parse({ schema: normalized }); // NormalizedJSONSchema → ASTNode
	const generated = generate(ast); // ASTNode → TS (Zod) code
	return format(generated);
}
