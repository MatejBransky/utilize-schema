import {
	type Dialect,
	isPlainObject,
	Meta,
	type ParsedJSONSchemaObject,
	withSourceMeta,
} from '@utilize/json-schema';

import { constraintKeywords } from './constraints';
import { mergeObjectSchemas } from './mergeObjects';

const REFERENCE_KEYWORDS: ReadonlySet<string> = new Set(['$ref']);

/**
 * How the keywords next to a `$ref` are generated:
 *
 * - `none`: only the reference. The dialect ignores the siblings (draft-07 and
 *   older), or they are annotations or filters that `generateSchema` applies
 *   to the node anyway.
 * - `merge`: the target and the siblings are disjoint object schemas, merged
 *   into one struct, so the decoded type includes the sibling properties.
 * - `check`: the reference is kept and the siblings are checked with a filter.
 *   Used when merging is not possible: a non-object or recursive target, or
 *   siblings that cannot be merged. Inlining a recursive target would never
 *   end, and the filter keeps its declaration shared.
 */
export type ReferenceSiblings =
	| { kind: 'none' }
	| { kind: 'merge'; merged: ParsedJSONSchemaObject | false }
	| { kind: 'check'; constraints: ParsedJSONSchemaObject };

/**
 * Decides how to generate the siblings of a `$ref` node. The schema generator
 * and the value types both call this, so the value type always matches the
 * generated schema.
 */
export function planReferenceSiblings(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect,
	isCyclic: (schema: ParsedJSONSchemaObject) => boolean
): ReferenceSiblings {
	if (dialect.refSiblings === 'ignore') {
		return { kind: 'none' };
	}

	const constraints = referenceConstraints(schema);

	if (Object.keys(constraints).length === 0) {
		return { kind: 'none' };
	}

	const target = schema[Meta]?.reference;

	if (isPlainObject(target) && !isCyclic(target as ParsedJSONSchemaObject)) {
		const { allOf, ...rest } = constraints;
		const result = mergeObjectSchemas([
			target as ParsedJSONSchemaObject,
			...(Array.isArray(allOf) ? allOf : []),
			withSourceMeta(schema, rest) as ParsedJSONSchemaObject,
		]);

		if (result.merged !== undefined) {
			return { kind: 'merge', merged: result.merged };
		}
	}

	return { kind: 'check', constraints };
}

/**
 * The constraint keywords of a `$ref` node: everything except the reference,
 * annotations and filter keywords (`not`, `if`, ...), which `generateSchema`
 * applies to the whole node.
 */
function referenceConstraints(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return constraintKeywords(schema, REFERENCE_KEYWORDS);
}
