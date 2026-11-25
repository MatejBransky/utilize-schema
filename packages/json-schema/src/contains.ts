import { type Dialect, isKeywordApplicable } from './dialect';
import type { ParsedJSONSchemaObject } from './model';

export interface ContainsBounds {
	/** Smallest number of matching items the array may contain. */
	min: number;
	/** Largest number of matching items the array may contain, when `maxContains` applies. */
	max?: number;
	/**
	 * Whether `minContains` or `maxContains` is declared. Without them `contains`
	 * only needs a single match, which a generator can check without counting.
	 */
	counted: boolean;
}

/**
 * The bounds `contains`, `minContains` and `maxContains` put on the number of
 * matching items. Returns `undefined` when the node has no applicable
 * `contains`, or when the bounds allow any number of matches.
 */
export function containsBounds(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): ContainsBounds | undefined {
	if (schema.contains === undefined || !isKeywordApplicable(dialect, 'contains')) {
		return undefined;
	}

	const minContains = isKeywordApplicable(dialect, 'minContains') ? schema.minContains : undefined;
	const maxContains = isKeywordApplicable(dialect, 'maxContains') ? schema.maxContains : undefined;
	const min = typeof minContains === 'number' ? minContains : 1;
	const max = typeof maxContains === 'number' ? maxContains : undefined;

	if (min <= 0 && max === undefined) {
		return undefined;
	}

	return { min, max, counted: typeof minContains === 'number' || max !== undefined };
}
