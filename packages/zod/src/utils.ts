import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { CustomSchemaResolver } from './generators/types';

export const ts = String.raw;

export const NEWLINE = '\n';

/**
 * Renders an object-literal key. A computed key is the only form that creates
 * an own `__proto__` property; the plain and quoted forms set the prototype of
 * the literal instead.
 */
export function shapeKey(key: string): string {
	return key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);
}

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
export function isRefNode(
	schema: ParsedJSONSchemaObject
): schema is ParsedJSONSchemaObject & { $ref: string } {
	return typeof schema.$ref === 'string';
}
