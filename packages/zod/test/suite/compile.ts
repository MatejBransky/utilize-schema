import { type ExternalSchemas, type JSONSchema, parse } from '@utilize/json-schema';
import { evaluateGeneratedCode, nameRootSchema } from '@utilize/test-utils/suite/evaluate';

import { z } from 'zod';

import { type FormatMode, generate } from '../../src/generator';

/**
 * Compiles a schema to a Zod schema in memory: the generated code is evaluated
 * with `z` in scope (see `evaluateGeneratedCode`).
 *
 * The existing `compileToZod` helper writes a module and imports it. That is
 * the right tool for a handful of schemas; the suite runs over hundreds.
 */
export async function compileToZodSchema(
	schema: JSONSchema | boolean,
	externalSchemas?: ExternalSchemas,
	formatMode?: FormatMode
): Promise<z.ZodType> {
	const { root } = await parse(schema as JSONSchema, {
		cwd: __dirname + '/',
		fileName: 'Root.json',
		externalSchemas,
	});

	const code = generate(root, {
		importZod: false,
		formatMode,
		customNameResolver: nameRootSchema,
	});

	return evaluateGeneratedCode(code, { z });
}
