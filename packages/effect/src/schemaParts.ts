/**
 * Reads the parts of a schema that both the generated Effect schema and its
 * value type are built from, so the two always agree on the shape.
 */

import { isParsedJSONSchemaObject, isPlainObject, withSourceMeta } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

/**
 * The declaring schema without the `allOf` that is being merged and without the
 * filter keywords, which are applied on top of the merged object.
 */
export function parentSchema(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return withSourceMeta(schema, {
		...schema,
		allOf: undefined,
		not: undefined,
		if: undefined,
		then: undefined,
		else: undefined,
	});
}

/** The `items` keyword, which is a single schema or a tuple of schemas before 2020-12. */
export function itemsOf(
	schema: ParsedJSONSchemaObject
): ParsedJSONSchema | ParsedJSONSchema[] | undefined {
	const items: unknown = schema.items;

	if (Array.isArray(items)) {
		return items.filter(isParsedSchema);
	}

	return isParsedSchema(items) ? items : undefined;
}

/** The positional tuple items: `prefixItems` in 2020-12, an `items` array before it. */
export function prefixItemsOf(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): ParsedJSONSchema[] | undefined {
	if (dialect.tuple === 'prefixItems') {
		return Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined;
	}

	const items = itemsOf(schema);

	return Array.isArray(items) ? items : undefined;
}

function isParsedSchema(value: unknown): value is ParsedJSONSchema {
	return value === null || typeof value === 'boolean' || isParsedJSONSchemaObject(value);
}

/** The schema of the items after the tuple items, or `false` when there may be none. */
export function arrayRest(
	schema: ParsedJSONSchemaObject,
	items: ParsedJSONSchema | ParsedJSONSchema[] | undefined,
	dialect: Dialect
): ParsedJSONSchema | false {
	if (dialect.tuple === 'prefixItems') {
		if (items === false) {
			return false;
		}

		return Array.isArray(items) ? true : (items ?? true);
	}

	if (schema.additionalItems === false) {
		return false;
	}

	return schema.additionalItems ?? true;
}

export interface ObjectKeys {
	properties: Record<string, ParsedJSONSchema>;
	required: Set<string>;
	/** Every declared property, then every required key that has no property schema. */
	keys: string[];
}

export function objectKeys(schema: ParsedJSONSchemaObject): ObjectKeys {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === 'string')
			: []
	);
	const keys = [...new Set([...Object.keys(properties), ...required])];

	return { properties, required, keys };
}
