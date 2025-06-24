import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

interface StandaloneSchemasResult {
	schemas: ParsedJSONSchemaObject[];
	edges: [ParsedJSONSchemaObject | null, ParsedJSONSchemaObject][];
}

// Helper to collect all standalone schemas: referenced and $defs/definitions
export function collectStandaloneSchemas(
	root: ParsedJSONSchemaObject
): StandaloneSchemasResult {
	const standalone = new Set<ParsedJSONSchemaObject>();
	const seen = new Set<ParsedJSONSchemaObject>();
	const edges = new Set<
		[ParsedJSONSchemaObject | null, ParsedJSONSchemaObject]
	>();

	function visit(
		schema: ParsedJSONSchemaObject | undefined,
		parent: ParsedJSONSchemaObject | null
	) {
		if (typeof schema !== 'object' || schema === null) return;

		edges.add([parent, schema]);

		if (!schema || seen.has(schema)) return;
		seen.add(schema);

		// 1. If schema is referenced by $ref somewhere, mark as standalone
		if (schema[Meta]?.reference && !schema[Meta].isCircular) {
			standalone.add(schema[Meta].reference);
			visit(schema[Meta].reference, schema);
		}

		const definitions = schema.$defs || schema.definitions;

		// 2. If schema is in $defs or definitions, mark as standalone
		if (definitions) {
			for (const def of Object.values(definitions)) {
				standalone.add(def);
				visit(def, schema);
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

		if (
			schema.additionalProperties &&
			typeof schema.additionalProperties === 'object'
		) {
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

		if (schema.additionalItems && typeof schema.additionalItems === 'object') {
			visit(schema.additionalItems, schema);
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

	return { schemas: Array.from(standalone), edges: Array.from(edges) };
}
