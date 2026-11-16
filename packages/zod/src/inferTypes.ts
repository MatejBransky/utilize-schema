import { type JSONSchemaTypeName, Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

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
	'additionalItems',
	'contains',
	'minItems',
	'maxItems',
	'uniqueItems',
];

const stringKeywords = ['pattern', 'minLength', 'maxLength', 'format'];

const numberKeywords = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'];

/**
 * JSON Schema keywords only constrain instances of their own type, so schemas
 * often omit `type` (`{ pattern: ... }`, `{ required: [...] }`). Infer the type
 * when exactly one kind of keyword is present, so the generator does not fall
 * back to `z.unknown()` and silently skip the constraint.
 */
export function inferTypes(root: ParsedJSONSchemaObject) {
	const seen = new Set<ParsedJSONSchemaObject>();

	function visit(schema: ParsedJSONSchemaObject | undefined) {
		if (typeof schema !== 'object' || schema === null || seen.has(schema)) {
			return;
		}

		seen.add(schema);
		inferType(schema);

		if (schema[Meta]?.reference) {
			visit(schema[Meta].reference);
		}

		for (const value of Object.values(schema.properties ?? {})) {
			visit(value);
		}

		for (const value of Object.values(schema.patternProperties ?? {})) {
			visit(value);
		}

		if (typeof schema.additionalProperties === 'object') {
			visit(schema.additionalProperties);
		}

		if (schema.propertyNames) {
			visit(schema.propertyNames);
		}

		if (Array.isArray(schema.items)) {
			for (const item of schema.items) {
				visit(item);
			}
		} else if (schema.items) {
			visit(schema.items);
		}

		if (typeof schema.additionalItems === 'object') {
			visit(schema.additionalItems);
		}

		visit(schema.contains);

		if (schema.dependencies) {
			for (const dependency of Object.values(schema.dependencies)) {
				if (typeof dependency === 'object' && !Array.isArray(dependency)) {
					visit(dependency);
				}
			}
		}

		for (const subschema of schema.allOf ?? []) {
			visit(subschema);
		}

		for (const subschema of schema.anyOf ?? []) {
			visit(subschema);
		}

		for (const subschema of schema.oneOf ?? []) {
			visit(subschema);
		}

		visit(schema.not);

		visit(schema.if as ParsedJSONSchemaObject | undefined);
		visit(schema.then as ParsedJSONSchemaObject | undefined);
		visit(schema.else as ParsedJSONSchemaObject | undefined);

		for (const value of Object.values(schema.$defs ?? {})) {
			visit(value);
		}

		for (const value of Object.values(schema.definitions ?? {})) {
			visit(value);
		}
	}

	visit(root);
}

function inferType(schema: ParsedJSONSchemaObject) {
	if (
		schema.type !== undefined ||
		'$ref' in schema ||
		schema.anyOf ||
		schema.oneOf ||
		schema.allOf ||
		schema.const !== undefined ||
		schema.enum
	) {
		return;
	}

	const record = schema as unknown as Record<string, unknown>;
	const categories = [
		['object', objectKeywords],
		['array', arrayKeywords],
		['string', stringKeywords],
		['number', numberKeywords],
	] as const;

	const inferred = categories.filter(([, keywords]) =>
		keywords.some((keyword) => record[keyword] !== undefined)
	);

	if (inferred.length === 1) {
		schema.type = inferred[0]![0] as JSONSchemaTypeName;
	}
}
