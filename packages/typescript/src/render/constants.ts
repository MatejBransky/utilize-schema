/** Keywords that change the rendered type; validation and annotations are ignored. */
export const TYPE_KEYWORDS = new Set([
	'$ref',
	'type',
	'const',
	'enum',
	'allOf',
	'anyOf',
	'oneOf',
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'items',
	'prefixItems',
	'additionalItems',
]);

/** Types the renderer emits; schema names must not shadow them. */
export const RENDERED_GLOBAL_TYPES = ['Array', 'Record'] as const;

const INDENT = '\t';

export function indent(level: number): string {
	return INDENT.repeat(level);
}
