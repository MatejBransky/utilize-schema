import { schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

export type InferenceMode = 'spec' | 'pragmatic';

const OBJECT_KEYWORDS = ['properties', 'patternProperties', 'additionalProperties', 'required'];

const ARRAY_KEYWORDS = ['items', 'prefixItems'];

const PRAGMATIC_OBJECT_KEYWORDS = [
	...OBJECT_KEYWORDS,
	'dependencies',
	'dependentRequired',
	'dependentSchemas',
	'propertyNames',
	'minProperties',
	'maxProperties',
	'unevaluatedProperties',
];

const PRAGMATIC_ARRAY_KEYWORDS = [
	...ARRAY_KEYWORDS,
	'additionalItems',
	'contains',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minContains',
	'maxContains',
	'unevaluatedItems',
];

const PRAGMATIC_STRING_KEYWORDS = [
	'format',
	'minLength',
	'maxLength',
	'pattern',
	'contentEncoding',
	'contentMediaType',
];

const PRAGMATIC_NUMBER_KEYWORDS = [
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
];

/**
 * A schema without `type` can still have a shape: `properties`, `required` and
 * `patternProperties` describe an object, `items` and `prefixItems` describe an
 * array. Those keywords infer the emitted type in both modes, mirroring
 * `json-schema-to-typescript`.
 *
 * Scalar constraints do not infer anything in `spec` mode. `maximum` only
 * applies to numbers, so `{ maximum: 3 }` also accepts `"foo"`; typing it as
 * `number` would reject a spec-valid instance. A schema that only bounds values
 * therefore stays `unknown`.
 *
 * `pragmatic` mode is opt-in and reads the keyword family as the intended type:
 * `format` becomes `string`, `minimum` becomes `number`, `contains` becomes
 * `array`. It is convenient for real-world schemas that omit `type`, but it
 * rejects spec-valid instances of other types.
 */
export function inferFamily(
	schema: ParsedJSONSchemaObject,
	inference: InferenceMode | undefined
): 'object' | 'array' | 'string' | 'number' | undefined {
	const record = schemaRecord(schema);
	const pragmatic = inference === 'pragmatic';
	const objectKeywords = pragmatic ? PRAGMATIC_OBJECT_KEYWORDS : OBJECT_KEYWORDS;
	const arrayKeywords = pragmatic ? PRAGMATIC_ARRAY_KEYWORDS : ARRAY_KEYWORDS;

	if (objectKeywords.some((keyword) => record[keyword] !== undefined)) {
		return 'object';
	}
	if (arrayKeywords.some((keyword) => record[keyword] !== undefined)) {
		return 'array';
	}
	if (pragmatic && PRAGMATIC_STRING_KEYWORDS.some((keyword) => record[keyword] !== undefined)) {
		return 'string';
	}
	if (pragmatic && PRAGMATIC_NUMBER_KEYWORDS.some((keyword) => record[keyword] !== undefined)) {
		return 'number';
	}

	return undefined;
}
