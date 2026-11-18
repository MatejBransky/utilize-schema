import {
	type Dialect,
	type JSONSchemaTypeName,
	type ParsedJSONSchemaObject,
	isKeywordApplicable,
} from '@utilize/json-schema';

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
 * Returns the single type a keyword-only schema constrains, if there is one.
 * The schema itself stays untyped: JSON Schema keywords only apply to values of
 * their own type and must not reject other types.
 */
export function inferTypeKeyword(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): JSONSchemaTypeName | undefined {
	if (
		schema.type !== undefined ||
		'$ref' in schema ||
		schema.anyOf ||
		schema.oneOf ||
		schema.allOf ||
		(schema.const !== undefined && isKeywordApplicable(dialect, 'const')) ||
		schema.enum
	) {
		return undefined;
	}

	const record = schema as unknown as Record<string, unknown>;
	const categories = [
		['object', objectKeywords],
		['array', arrayKeywords],
		['string', stringKeywords],
		['number', numberKeywords],
	] as const;

	const inferred = categories.filter(([, keywords]) =>
		keywords.some(
			(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
		)
	);

	if (inferred.length === 1) {
		return inferred[0]![0] as JSONSchemaTypeName;
	}

	return undefined;
}
