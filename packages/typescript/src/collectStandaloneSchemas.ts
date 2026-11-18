import {
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

export type SchemaEdge = [ParsedJSONSchemaObject | null, ParsedJSONSchemaObject];

/**
 * A `$defs` or `definitions` entry that is a boolean schema. Booleans carry no
 * metadata, so the path is kept to name the declaration.
 */
export interface BooleanDefinition {
	schema: boolean;
	path: Array<string | number>;
}

interface StandaloneSchemasResult {
	schemas: ParsedJSONSchemaObject[];
	booleanDefinitions: BooleanDefinition[];
	edges: SchemaEdge[];
}

// Helper to collect all standalone schemas: referenced and $defs/definitions
export function collectStandaloneSchemas(root: ParsedJSONSchemaObject): StandaloneSchemasResult {
	const standalone = new Set<ParsedJSONSchemaObject>();
	const booleanDefinitions: BooleanDefinition[] = [];
	const seen = new Set<ParsedJSONSchemaObject>();
	const edges = new Set<[ParsedJSONSchemaObject | null, ParsedJSONSchemaObject]>();

	function visit(
		schema: ParsedJSONSchemaObject | boolean | undefined,
		parent: ParsedJSONSchemaObject | null
	) {
		if (typeof schema !== 'object' || schema === null) return;

		edges.add([parent, schema]);

		if (!schema || seen.has(schema)) return;
		seen.add(schema);

		// 1. If schema is referenced by $ref somewhere, mark as standalone
		const reference = schema[Meta]?.reference;

		if (typeof reference === 'object' && reference !== null) {
			standalone.add(reference);
			visit(reference, schema);
		}

		// 2. If schema is in $defs or definitions, mark as standalone.
		// Definitions get their own const, so they are not ordered under the
		// schema that declares them: ordering must follow $ref edges only.
		// Both namespaces are valid at once, so neither may shadow the other.
		const basePath = schema[Meta]?.path ?? [];

		for (const namespace of ['$defs', 'definitions'] as const) {
			const definitions = schema[namespace] as unknown as
				| Record<string, ParsedJSONSchema>
				| undefined;

			if (!isPlainObject(definitions)) continue;

			for (const [key, definition] of Object.entries(definitions)) {
				if (isPlainObject(definition)) {
					standalone.add(definition as ParsedJSONSchemaObject);
					visit(definition as ParsedJSONSchemaObject, null);
				} else if (typeof definition === 'boolean') {
					booleanDefinitions.push({
						schema: definition,
						path: [...basePath, namespace, key],
					});
				}
			}
		}

		// 3. Traverse properties, items, etc.
		if (schema.properties) {
			for (const prop of Object.values(schema.properties)) {
				visit(prop, schema);
			}
		}

		if (schema.patternProperties) {
			for (const prop of Object.values(schema.patternProperties)) {
				visit(prop, schema);
			}
		}

		if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
			visit(schema.additionalProperties, schema);
		}

		if (schema.items) {
			if (Array.isArray(schema.items)) {
				for (const item of schema.items) {
					visit(item, schema);
				}
			} else {
				visit(schema.items, schema);
			}
		}

		if (schema.prefixItems) {
			for (const item of schema.prefixItems) {
				visit(item, schema);
			}
		}

		if (schema.additionalItems && typeof schema.additionalItems === 'object') {
			visit(schema.additionalItems, schema);
		}

		if (schema.contains) {
			visit(schema.contains, schema);
		}

		if (schema.propertyNames) {
			visit(schema.propertyNames, schema);
		}

		if (schema.if) {
			visit(schema.if as ParsedJSONSchemaObject, schema);
		}

		if (schema.then) {
			visit(schema.then as ParsedJSONSchemaObject, schema);
		}

		if (schema.else) {
			visit(schema.else as ParsedJSONSchemaObject, schema);
		}

		if (schema.allOf) schema.allOf.forEach((n) => visit(n, schema));
		if (schema.anyOf) schema.anyOf.forEach((n) => visit(n, schema));
		if (schema.oneOf) schema.oneOf.forEach((n) => visit(n, schema));
		if (schema.not) visit(schema.not, schema);

		if (schema.dependencies) {
			for (const dep of Object.values(schema.dependencies)) {
				if (typeof dep === 'object' && dep !== null && !Array.isArray(dep)) {
					visit(dep, schema);
				}
			}
		}
	}

	visit(root, null);

	// Always include root as standalone
	standalone.add(root);

	return { schemas: Array.from(standalone), booleanDefinitions, edges: Array.from(edges) };
}
