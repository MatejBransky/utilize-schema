import {
	$RefParser,
	type ParserOptions as $RefOptions,
} from '@apidevtools/json-schema-ref-parser';
import type { JSONSchemaObject } from '@apidevtools/json-schema-ref-parser/dist/lib/types';

import { Reference, type JSONSchema } from './types/JSONSchema';
import { justName, omitFields, toSafeString } from './utils';

export interface DereferenceOptions {
	/** The current working directory where the schema is located. */
	cwd: string;
	/** Options for the $RefParser */
	$refOptions?: $RefOptions;
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
	const dereferencedSchema = (await parser.dereference(cwd, schema, {
		...$refOptions,
		dereference: {
			...$refOptions?.dereference,
			onDereference(
				$ref: string,
				schema: JSONSchemaObject,
				parent?: JSONSchemaObject,
				parentPropName?: string
			) {
				const referencedSchema = parser.$refs.exists($ref, {})
					? (parser.$refs.get($ref) as JSONSchemaObject)
					: undefined;

				if (referencedSchema) {
					if (referencedSchema === schema) {
						schema = { $ref };
					} else {
						schema = omitFields(schema, referencedSchema) as JSONSchemaObject;
						schema.$ref = $ref;
					}

					if (parent && parentPropName) {
						parent[parentPropName] = schema;
					}

					if (!referencedSchema.$id) {
						referencedSchema.$id = toSafeString(justName($ref));
					}

					Object.defineProperty(schema, Reference, {
						enumerable: false,
						value: referencedSchema,
						writable: false,
					});
				} else {
					/**
					 * If the referenced schema does not exist, we still want to
					 * set the $id for the schema being dereferenced as we want to preserve standalone schema for it.
					 */
					if (!schema.$id) {
						schema.$id = toSafeString(justName($ref));
					}
				}
			},
		},
	})) as JSONSchema;
	return dereferencedSchema;
}
