import { type ParsedJSONSchemaObject, withSourceMeta } from '@utilize/json-schema';

/** Keys that describe a node rather than constrain its value. */
const REF_ANNOTATIONS = new Set([
	'$ref',
	'$schema',
	'$id',
	'id',
	'$anchor',
	'$vocabulary',
	'$comment',
	'title',
	'description',
	'default',
	'examples',
	'readOnly',
	'writeOnly',
	'deprecated',
	'format',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
	'definitions',
	'$defs',
	'discriminator',
]);

/**
 * The constraint keywords of a `$ref` node, without the reference itself and
 * without annotations. 2019-09 and newer apply these next to the reference.
 */
export function referenceConstraints(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	const rest: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(schema)) {
		if (value !== undefined && !REF_ANNOTATIONS.has(key)) {
			rest[key] = value;
		}
	}

	return withSourceMeta(schema, rest) as unknown as ParsedJSONSchemaObject;
}
