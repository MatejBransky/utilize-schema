import type { schemaRecord } from '@utilize/json-schema';

import type { InferenceMode } from './context';

export type Family = 'object' | 'array' | 'string' | 'number';

const SPEC_KEYWORDS: Record<Family, string[]> = {
	object: 'properties patternProperties additionalProperties required'.split(' '),
	array: 'items prefixItems'.split(' '),
	string: [],
	number: [],
};

const PRAGMATIC_KEYWORDS: Record<Family, string[]> = {
	object:
		'properties patternProperties additionalProperties required dependencies dependentRequired dependentSchemas propertyNames minProperties maxProperties unevaluatedProperties'.split(
			' '
		),
	array:
		'items prefixItems additionalItems contains minItems maxItems uniqueItems minContains maxContains unevaluatedItems'.split(
			' '
		),
	string: 'format minLength maxLength pattern contentEncoding contentMediaType'.split(' '),
	number: 'minimum maximum exclusiveMinimum exclusiveMaximum multipleOf'.split(' '),
};

export function inferFamily(
	record: ReturnType<typeof schemaRecord>,
	inference: InferenceMode | undefined
): Family | undefined {
	const keywords = inference === 'pragmatic' ? PRAGMATIC_KEYWORDS : SPEC_KEYWORDS;

	for (const family of ['object', 'array', 'string', 'number'] as const) {
		if (keywords[family].some((keyword) => record[keyword] !== undefined)) {
			return family;
		}
	}

	return undefined;
}
