import { dialectOf, isKeywordApplicable } from './dialect';
import type { Dialect } from './dialect';
import { isParsedJSONSchemaObject, withSourceMeta } from './model';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from './model';
import { isPlainObject, schemaRecord } from './utils';

const TYPE_SPECIFIC_KEYWORDS = [
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'propertyNames',
	'dependencies',
	'items',
	'prefixItems',
	'additionalItems',
	'contains',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minLength',
	'maxLength',
	'pattern',
	'format',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
] as const;

/**
 * JSON Schema keywords apply only to instances of the matching type, so a
 * subschema without `type` is permissive. A caller that knows the type of the
 * value the subschema is applied to can narrow it to that type: `propertyNames`
 * always validates strings, a schema dependency always validates objects, and
 * `not`/`if`/`then`/`else` inherit the parent type.
 *
 * Nodes that already declare a type, a reference, a combinator or a literal are
 * returned as they are, and so are nodes without a keyword of the target type:
 * narrowing those would add a filter that changes nothing.
 */
export function narrowUntypedSchema(
	schema: ParsedJSONSchema,
	type: string | undefined,
	fallback: Dialect
): ParsedJSONSchema {
	if (type === undefined || !isPlainObject(schema)) {
		return schema;
	}

	if (!isParsedJSONSchemaObject(schema)) {
		return schema;
	}

	const node = schema;

	if (
		node.type !== undefined ||
		node.$ref !== undefined ||
		node.anyOf !== undefined ||
		node.oneOf !== undefined ||
		node.allOf !== undefined ||
		Object.hasOwn(node, 'const') ||
		node.enum !== undefined
	) {
		return schema;
	}

	const dialect = dialectOf(node, fallback);

	if (!hasTypeSpecificKeywords(node, dialect)) {
		return schema;
	}

	return withSourceMeta(node, { ...node, type });
}

function hasTypeSpecificKeywords(schema: ParsedJSONSchemaObject, dialect: Dialect): boolean {
	const record = schemaRecord(schema);

	return TYPE_SPECIFIC_KEYWORDS.some(
		(keyword) =>
			record[keyword] !== undefined &&
			// The normalizer rewrites `dependentRequired` and `dependentSchemas`
			// into `dependencies` for every dialect, so the node carries a
			// keyword the target dialect does not spell that way.
			(keyword === 'dependencies' || isKeywordApplicable(dialect, keyword))
	);
}
