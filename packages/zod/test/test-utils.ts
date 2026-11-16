import { type JSONSchema, Meta, parse, type ParsedJSONSchemaObject } from '@utilize/json-schema';
import { format as formatCode } from 'oxfmt';
import { type z } from 'zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generate } from '../src/generator';

/**
 * A tagged template literal function for expected TypeScript code. Code is
 * compared with whitespace normalized, so the generated output does not need
 * to be formatted.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) =>
	formatSource(String.raw(strings, ...values));

const formatOptions = {
	bracketSpacing: true,
	endOfLine: 'lf',
	semi: true,
	singleQuote: true,
	trailingComma: 'es5',
	useTabs: true,
	objectWrap: 'collapse',
} as const;

function formatSource(code: string) {
	return formatCode('code.ts', code, formatOptions).then((result) => result.code);
}

export function normalizeCode(code: string): string {
	return code.replace(/\r\n?/g, '\n').trim();
}

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
	return formatSource(code);
}

/**
 * Compiles the schema, runs the generated module and returns its `Root` zod
 * schema. The module is written next to the tests, so `zod` resolves from
 * this package, and removed after it is loaded.
 */
export async function compileModule(schema: JSONSchema): Promise<Record<string, z.ZodType>> {
	const code = await compile(schema, { importZod: true });
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	try {
		const filePath = join(directory, 'schema.ts');
		await writeFile(filePath, code);
		return (await import(filePath)) as Record<string, z.ZodType>;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function compileToZod(schema: JSONSchema): Promise<z.ZodType> {
	const module = await compileModule(schema);
	return module.Root!;
}
