import { isParsedJSONSchemaObject, Meta, parse } from '@utilize/json-schema';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
import { formatSource, ts } from '@utilize/test-utils/code';

import { generate } from '../src/generator';
import type { GenerateOptions } from '../src/generator';

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

export { ts };

export function withMeta(obj: JSONSchema, meta: Partial<Meta> = {}): ParsedJSONSchemaObject {
	Object.defineProperty(obj, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});

	if (!isParsedJSONSchemaObject(obj)) {
		throw new Error('Expected schema metadata to be attached');
	}

	return obj;
}

/** The captured output of a failed child process, without trusting the thrown value. */
export function commandOutput(error: unknown) {
	if (typeof error !== 'object' || error === null) {
		return { stdout: '', stderr: '' };
	}

	const stdout = 'stdout' in error ? error.stdout : undefined;
	const stderr = 'stderr' in error ? error.stderr : undefined;

	return {
		stdout: typeof stdout === 'string' ? stdout : '',
		stderr: typeof stderr === 'string' ? stderr : '',
	};
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
