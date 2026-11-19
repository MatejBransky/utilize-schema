import { type ExternalSchemas, Meta, type JSONSchema, parse } from '@utilize/json-schema';
import { Schema } from 'effect';

import { stripTypeScriptTypes } from 'node:module';

import { generate } from '../../src/generator';

type GeneratedSchema = Parameters<typeof Schema.decodeUnknownSync>[0];

/**
 * Compiles a schema to an Effect Schema in memory. Generated code is stripped of
 * its TypeScript syntax and evaluated with `Schema` in scope, which keeps the
 * suite fast: hundreds of schemas compile without touching the filesystem.
 */
export async function compileToSchema(
	schema: JSONSchema | boolean,
	externalSchemas?: ExternalSchemas
): Promise<GeneratedSchema> {
	const { root } = await parse(schema as JSONSchema, {
		cwd: `${import.meta.dirname}/`,
		fileName: 'Root.json',
		externalSchemas,
	});

	const code = generate(root, {
		importEffect: false,
		// The suite has schemas with `$id` or `title`, so pin the root name.
		customNameResolver: (parsedSchema) =>
			parsedSchema[Meta]?.parent === null && parsedSchema[Meta]?.fileName === 'Root.json'
				? 'Root'
				: undefined,
	});

	return evaluate(code);
}

function evaluate(code: string): GeneratedSchema {
	// A boolean root schema is emitted as a bare expression.
	if (!code.includes('export ')) {
		return new Function('Schema', `return ${code}`)(Schema) as GeneratedSchema;
	}

	const javascript = stripTypeScriptTypes(code, { mode: 'strip' }).replace(
		/^export const /gm,
		'const '
	);

	return new Function('Schema', `${javascript}\nreturn Root;`)(Schema) as GeneratedSchema;
}
