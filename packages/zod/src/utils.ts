import { isPlainObject, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { CustomSchemaResolver } from './generators/types';

export const ts = String.raw;

export const NEWLINE = '\n';

export function isSchemaObject<S = ParsedJSONSchemaObject>(schema: unknown): schema is S {
	return isPlainObject(schema);
}

/** True when `customSchemaResolver` replaces the node with caller-provided code. */
export function isResolvedByCaller(
	resolver: CustomSchemaResolver | undefined,
	schema: ParsedJSONSchemaObject
): boolean {
	return resolver?.(schema) !== undefined;
}

/**
 * True for a `$ref` node. Such a node always takes the reference branch first:
 * the reference decides whether the dialect applies the keywords next to it.
 */
export function isRefNode(schema: ParsedJSONSchemaObject): boolean {
	return typeof schema.$ref === 'string';
}
