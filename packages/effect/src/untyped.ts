import { isKeywordApplicable, schemaRecord } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { generateArray } from './array';
import type { Context, JSONValueType } from './context';
import { JSON_VALUE_TYPES } from './context';
import { formatCheck } from './formats';
import { generateNumber } from './number';
import { generateObject } from './object';
import { generateString } from './string';

/**
 * Builds a static schema for a schema that has type-specific keywords but no
 * `type`. JSON Schema keywords only constrain the type they apply to, so the
 * result is a union over all JSON value types, with the matching ones refined.
 */
export function generateUntyped(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = context.dialect;
	const constrained = JSON_VALUE_TYPES.filter((type) =>
		appliesTo(schema, type, dialect, (context.formatMode ?? 'assert') === 'assert')
	);

	if (constrained.length === 0) {
		return 'Schema.Json';
	}

	const members = [
		'Schema.Null',
		'Schema.Boolean',
		constrained.includes('string') ? generateString(schema, context) : 'Schema.String',
		constrained.includes('number') ? generateNumber(schema, false) : 'Schema.Finite',
		constrained.includes('object') ? generateObject(schema, context) : 'Schema.JsonObject',
		constrained.includes('array') ? generateArray(schema, context) : 'Schema.Array(Schema.Json)',
	];

	return `Schema.Union([${[...new Set(members)].join(', ')}])`;
}

function appliesTo(
	schema: ParsedJSONSchemaObject,
	type: JSONValueType,
	dialect: Dialect,
	assertFormats: boolean
): boolean {
	const record = schemaRecord(schema);
	const anyKeyword = (keywords: string[]) =>
		keywords.some(
			(keyword) => record[keyword] !== undefined && isKeywordApplicable(dialect, keyword)
		);

	switch (type) {
		case 'string':
			// A format only constrains the string branch, so an untyped schema
			// asserts it the same way a typed one does. In annotate mode it adds
			// no check, so the branch stays plain `Schema.String`.
			return (
				anyKeyword(['minLength', 'maxLength', 'pattern']) ||
				(assertFormats &&
					typeof schema.format === 'string' &&
					formatCheck(schema.format) !== undefined)
			);
		case 'number':
			return anyKeyword([
				'minimum',
				'maximum',
				'exclusiveMinimum',
				'exclusiveMaximum',
				'multipleOf',
			]);
		case 'object':
			return anyKeyword([
				'properties',
				'patternProperties',
				'required',
				'additionalProperties',
				'minProperties',
				'maxProperties',
				'propertyNames',
				'dependencies',
			]);
		case 'array':
			return anyKeyword([
				'items',
				'prefixItems',
				'additionalItems',
				'minItems',
				'maxItems',
				'uniqueItems',
				'contains',
			]);
	}
}
