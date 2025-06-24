import {
	type JSONSchema,
	Meta,
	parse,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { generate } from '../src/generator';
import { format } from '../src/utils';

/**
 * A tagged template literal function that formats TypeScript code.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const rawString = String.raw(strings, ...values);
	return format(rawString);
};

export function withMeta(obj: JSONSchema, meta: Partial<Meta> = {}) {
	Object.defineProperty(obj, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});
	return obj as ParsedJSONSchemaObject;
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
