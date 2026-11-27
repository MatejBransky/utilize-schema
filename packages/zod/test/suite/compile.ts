import { parse } from '@utilize/json-schema';
import { createJsonSchemaValidator } from '@utilize/json-schema/runtime';
import type { DialectId, ExternalSchemas, JSONSchema } from '@utilize/json-schema';
import { evaluateGeneratedCode, nameRootSchema } from '@utilize/test-utils/suite/evaluate';
import { suiteDirectory } from '@utilize/test-utils/suite/loadSuite';

import { z } from 'zod';

import { generate } from '../../src/generator';
import type { FormatMode } from '../../src/generator';

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
	formatMode?: FormatMode,
	dialect?: DialectId
): Promise<z.ZodType> {
	const { root } = await parse(schema, {
		cwd: `${suiteDirectory}/`,
		fileName: 'Root.json',
		externalSchemas,
		dialect,
	});

	const code = generate(root, {
		importZod: false,
		formatMode,
		customNameResolver: nameRootSchema,
	});

	return evaluateGeneratedCode(code, { z, createJsonSchemaValidator });
}
