import { ANNOTATION_KEYWORDS, withSourceMeta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { FILTER_KEYWORDS } from './keywords';

const NO_KEYWORDS: ReadonlySet<string> = new Set();

/**
 * The keywords of a node that constrain a value on their own: everything except
 * the annotations, the filter keywords (`not`, `if`, ...), which
 * `generateSchema` applies to the whole node, and the ones in `excluded`.
 *
 * The copy keeps the source `[Meta]`, and with it the dialect of the resource
 * the node came from.
 */
export function constraintKeywords(
	schema: ParsedJSONSchemaObject,
	excluded: ReadonlySet<string> = NO_KEYWORDS
): ParsedJSONSchemaObject {
	const rest: Record<string, unknown> = {};

	for (const [keyword, value] of Object.entries(schema)) {
		if (
			value !== undefined &&
			!excluded.has(keyword) &&
			!ANNOTATION_KEYWORDS.has(keyword) &&
			!FILTER_KEYWORDS.has(keyword)
		) {
			rest[keyword] = value;
		}
	}

	return withSourceMeta(schema, rest) as ParsedJSONSchemaObject;
}
