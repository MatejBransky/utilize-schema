import {
	type ParserOptions as $RefOptions,
	$RefParser,
} from '@apidevtools/json-schema-ref-parser';

import type { JSONSchema } from './types/JSONSchema';

export type DereferencedPaths = WeakMap<JSONSchema, string>;

interface DereferenceOptions {
	/** The current working directory where the schema is located. */
	cwd: string;
	/** Options for the $RefParser */
	$refOptions: $RefOptions;
}

/**
 * Dereferences all $ref pointers in a JSON Schema using json-schema-ref-parser.
 * Tracks the original reference paths for each dereferenced schema node.
 *
 * @returns An object containing:
 *   - dereferencedPaths: A WeakMap mapping dereferenced schema nodes to their original $ref paths.
 *   - dereferencedSchema: The fully dereferenced schema.
 */
export async function dereference(
	schema: JSONSchema,
	{ cwd, $refOptions }: DereferenceOptions
) {
	const parser = new $RefParser();
	const dereferencedPaths: DereferencedPaths = new WeakMap();
	const dereferencedSchema = await parser.dereference(cwd, schema, {
		...$refOptions,
		dereference: {
			...$refOptions.dereference,
			onDereference($ref: string, schema: JSONSchema) {
				dereferencedPaths.set(schema, $ref);
			},
		},
	});
	return { dereferencedPaths, dereferencedSchema };
}
