import { ANNOTATION_KEYWORDS as SHARED_ANNOTATION_KEYWORDS } from '@utilize/json-schema';

/**
 * Keywords that only carry metadata, so they can be attached to any schema.
 * Effect only annotates `format` and `discriminator` instead of validating them.
 */
export const ANNOTATION_KEYWORDS: ReadonlySet<string> = new Set([
	...SHARED_ANNOTATION_KEYWORDS,
	'format',
	'discriminator',
]);

/**
 * Keywords applied as filters on top of a generated schema. `dependentRequired`
 * and `dependentSchemas` are merged into `dependencies` by the normalizer.
 */
export const FILTER_KEYWORDS: ReadonlySet<string> = new Set(['not', 'if', 'then', 'else']);
