/** Keywords that only carry metadata, so they can be attached to any schema. */
export const ANNOTATION_KEYWORDS: ReadonlySet<string> = new Set([
	'title',
	'description',
	'default',
	'examples',
	'$id',
	'id',
	'$schema',
	'$comment',
	'$anchor',
	'$vocabulary',
	'$defs',
	'definitions',
	'format',
	'readOnly',
	'writeOnly',
	'discriminator',
	'deprecated',
	'contentEncoding',
	'contentMediaType',
	'contentSchema',
]);

/**
 * Keywords applied as filters on top of a generated schema. `dependentRequired`
 * and `dependentSchemas` are merged into `dependencies` by the normalizer.
 */
export const FILTER_KEYWORDS: ReadonlySet<string> = new Set(['not', 'if', 'then', 'else']);
