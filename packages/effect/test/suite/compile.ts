import { type ExternalSchemas, type JSONSchema, parse } from '@utilize/json-schema';
import { evaluateGeneratedCode, nameRootSchema } from '@utilize/test-utils/suite/evaluate';
import { Schema } from 'effect';

import { type FormatMode, generate } from '../../src/generator';

export type SuiteGeneratedSchema = Parameters<typeof Schema.decodeUnknownSync>[0];

/**
 * Compiles a schema to an Effect Schema in memory: the generated code is
 * evaluated with `Schema` in scope (see `evaluateGeneratedCode`).
 *
 * The `compileToSchema` helper in `test-utils.ts` writes a module and imports
 * it. That is the right tool for a handful of schemas; the suite runs over
 * hundreds.
 */
export async function compileToEffectSchema(
	schema: JSONSchema | boolean,
	externalSchemas?: ExternalSchemas,
	formatMode?: FormatMode
): Promise<SuiteGeneratedSchema> {
	const { root } = await parse(schema as JSONSchema, {
		cwd: `${import.meta.dirname}/`,
		fileName: 'Root.json',
		externalSchemas,
	});

	const code = generate(root, {
		importEffect: false,
		formatMode,
		customNameResolver: nameRootSchema,
	});

	return evaluateGeneratedCode(code, { Schema });
}
