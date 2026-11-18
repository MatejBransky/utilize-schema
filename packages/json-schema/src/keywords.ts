/**
 * Keywords that describe or identify a schema but never constrain a value:
 * annotations, identifiers and definition containers.
 *
 * Next to a `$ref` they are not reported as ignored siblings, and generators
 * leave them out when they split the constraints of a node. `format` is not
 * listed: whether it validates depends on the generator.
 */
export const ANNOTATION_KEYWORDS: ReadonlySet<string> = new Set([
	'$schema',
	'$id',
	'id',
	'$anchor',
	'$vocabulary',
	'$comment',
	'$defs',
	'definitions',
	'title',
	'description',
	'default',
	'examples',
	'readOnly',
	'writeOnly',
	'deprecated',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
]);
