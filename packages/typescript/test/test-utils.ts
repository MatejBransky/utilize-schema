import {
	type JSONSchema,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	parse,
} from '@utilize/json-schema';
import { format as formatCode } from 'oxfmt';

import { generate, type GenerateOptions } from '../src/generator';

/** JSON Schema 2020-12 keywords that the draft-07 based `JSONSchema` type lacks. */
export type TestSchema = JSONSchema & {
	prefixItems?: JSONSchema[];
	deprecated?: boolean;
	minContains?: number;
	maxContains?: number;
	unevaluatedProperties?: boolean | JSONSchema;
	unevaluatedItems?: boolean | JSONSchema;
	dependentRequired?: Record<string, string[]>;
	dependentSchemas?: Record<string, JSONSchema>;
};

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

export interface CompileOptions extends GenerateOptions {
	fileName?: string;
}

async function parseSchema(
	schema: TestSchema,
	options: { fileName?: string } = {}
): Promise<ParsedJSONSchema> {
	const parsed = await parse(schema, {
		cwd: __dirname + '/',
		fileName: options.fileName ?? 'Root.json',
	});

	return parsed.root;
}

/** Generates code without formatting, for tests that assert on errors. */
export async function generateCode(
	schema: TestSchema,
	options: CompileOptions = {}
): Promise<string> {
	return generate(await parseSchema(schema, options), options);
}

/** Generates code and formats it the way the generator output is consumed. */
export async function compile(schema: TestSchema, options: CompileOptions = {}) {
	return formatSource(await generateCode(schema, options));
}
