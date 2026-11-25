import { isKeywordApplicable } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

const objectKeywords = [
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'propertyNames',
	'dependencies',
	'minProperties',
	'maxProperties',
];

const arrayKeywords = [
	'items',
	'prefixItems',
	'additionalItems',
	'contains',
	'minItems',
	'maxItems',
	'uniqueItems',
];

const stringKeywords = ['pattern', 'minLength', 'maxLength', 'format'];

const numberKeywords = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'];

/**
 * Returns the types a keyword-only schema constrains. The schema itself stays
 * untyped: JSON Schema keywords only apply to values of their own type and
 * must not reject other types, so each constrained type needs its own guarded
 * check. A schema can constrain more than one type, e.g.
 * `{ minLength: 2, minimum: 5 }` constrains strings and numbers.
 */
export type InferableType = 'object' | 'array' | 'string' | 'number';

export function inferTypeKeywords(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): InferableType[] {
	if (
		schema.type !== undefined ||
		'$ref' in schema ||
		schema.anyOf ||
		schema.oneOf ||
		schema.allOf ||
		(schema.const !== undefined && isKeywordApplicable(dialect, 'const')) ||
		schema.enum
	) {
		return [];
	}

	const record = schema as unknown as Record<string, unknown>;
	const categories = [
		['object', objectKeywords],
		['array', arrayKeywords],
		['string', stringKeywords],
		['number', numberKeywords],
	] as const;

	return categories.flatMap(([type, keywords]) =>
		keywords.some(
			(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
		)
			? [type]
			: []
	);
}
