import { type JSONSchema, Meta, parse } from '@utilize/json-schema';
import prettierConfig from '@utilize/prettier-config/prettier.json';
import {
	format as prettierFormat,
	type Options as PrettierOptions,
} from 'prettier';

import { generate } from '../src/generator';

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

export function withMeta<T extends JSONSchema>(
	obj: T,
	meta: Partial<Meta> = {}
) {
	Object.defineProperty(obj, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});
	return obj as T & { [Meta]: Meta };
}

export interface CompileOptions {
	importZod?: boolean;
	cwd?: string;
	fileName?: string;
}

export async function compile(schema: JSONSchema, options?: CompileOptions) {
	const parsed = await parse(schema, {
		cwd: options?.cwd ?? __dirname + '/',
		fileName: options?.fileName ?? 'Root.json',
	});
	const code = generate(parsed.root, {
		importZod: options?.importZod ?? false,
	});
	return format(code);
}
