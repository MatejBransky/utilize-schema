import {
	type ParserOptions as $RefOptions,
	$RefParser,
} from '@apidevtools/json-schema-ref-parser';

import { Linked, type JSONSchema } from './types/JSONSchema';
import { justName, toSafeString } from './utils';

export type DereferenceTrace = WeakMap<
	JSONSchema,
	{ path: string; referencingSchema: JSONSchema; referencedSchema?: JSONSchema }
>;

export interface DereferenceOptions {
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
	const dereferencedPaths: DereferenceTrace = new WeakMap();
	const dereferencedSchema = await parser.dereference(cwd, schema, {
		...$refOptions,
		dereference: {
			...$refOptions.dereference,
			onDereference($ref: string, schema: JSONSchema) {
				const referencedSchema = parser.$refs.exists($ref, {})
					? (parser.$refs.get($ref) as JSONSchema)
					: undefined;

				if (referencedSchema) {
					if (Object.prototype.hasOwnProperty.call(referencedSchema, Linked)) {
						referencedSchema[Linked]?.add(schema);
						if (!referencedSchema.$id) {
							referencedSchema.$id = toSafeString(justName($ref));
						}
					} else {
						Object.defineProperty(referencedSchema, Linked, {
							enumerable: false,
							value: new Set<JSONSchema>(),
							writable: false,
						});
					}
				}

				dereferencedPaths.set(schema, {
					path: $ref,
					referencingSchema: schema,
					referencedSchema,
				});
			},
		},
	});
	return { dereferencedPaths, dereferencedSchema };
}
