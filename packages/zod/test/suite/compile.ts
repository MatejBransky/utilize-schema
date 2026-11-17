import { Meta, type JSONSchema, parse } from '@utilize/json-schema';

import { stripTypeScriptTypes } from 'node:module';

import { z } from 'zod';

import { generate } from '../../src/generator';

/**
 * Compiles a schema to a Zod schema in memory. Generated code is stripped of
 * its TypeScript syntax and evaluated with `z` in scope, which keeps the suite
 * fast: hundreds of schemas compile without touching the filesystem.
 *
 * The existing `compileToZod` helper writes a module and imports it. That is
 * the right tool for a handful of schemas; the suite runs over hundreds.
 */
export async function compileToZodSchema(schema: JSONSchema | boolean): Promise<z.ZodType> {
	const { root } = await parse(schema as JSONSchema, {
		cwd: __dirname + '/',
		fileName: 'Root.json',
	});

	const code = generate(root, {
		importZod: false,
		// The suite has schemas with `$id` or `title`, so pin the root name and
		// keep the lookup in `evaluate` stable.
		customNameResolver: (parsedSchema) =>
			parsedSchema[Meta]?.parent === null ? 'Root' : undefined,
	});

	return evaluate(code);
}

function evaluate(code: string): z.ZodType {
	// A boolean root schema is emitted as a bare expression.
	if (!code.includes('export ')) {
		return new Function('z', `return ${code}`)(z);
	}

	// `stripTypeScriptTypes` removes type-only declarations but keeps the ESM
	// `export const` syntax, which the function body cannot contain.
	const javascript = stripTypeScriptTypes(code, { mode: 'strip' }).replace(
		/^export const /gm,
		'const '
	);

	return new Function('z', `${javascript}\nreturn Root;`)(z);
}
