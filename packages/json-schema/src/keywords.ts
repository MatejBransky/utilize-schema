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
	'$recursiveAnchor',
	'$dynamicAnchor',
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

/**
 * Keywords whose value is an object of subschemas, keyed by name. A schema
 * walker visits each value. `dependencies` is not listed: its values may also
 * be arrays of property names.
 */
export const SCHEMA_MAP_KEYWORDS: ReadonlySet<string> = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependentSchemas',
]);

/**
 * Keywords whose value is one subschema. `items` is not listed: before 2020-12
 * it may also be an array of subschemas.
 */
export const SINGLE_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
	'additionalProperties',
	'additionalItems',
	'unevaluatedProperties',
	'unevaluatedItems',
	'contentSchema',
	'contains',
	'propertyNames',
	'if',
	'then',
	'else',
	'not',
]);

/** Keywords whose value is an array of subschemas. */
export const SCHEMA_ARRAY_KEYWORDS: ReadonlySet<string> = new Set([
	'allOf',
	'anyOf',
	'oneOf',
	'prefixItems',
]);
