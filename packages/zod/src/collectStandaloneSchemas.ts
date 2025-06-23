import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

// Helper to collect all standalone schemas: referenced and $defs/definitions
export function collectStandaloneSchemas(
	root: ParsedJSONSchemaObject
): ParsedJSONSchemaObject[] {
	const standalone = new Set<ParsedJSONSchemaObject>();
	const seen = new Set<ParsedJSONSchemaObject>();

	function visit(schema: ParsedJSONSchemaObject | undefined) {
		if (typeof schema !== 'object' || schema === null) return;

		if (!schema || seen.has(schema)) return;
		seen.add(schema);

		// 1. If schema is referenced by $ref somewhere, mark as standalone
		if (schema[Meta]?.reference) {
			standalone.add(schema[Meta].reference);
			visit(schema[Meta].reference);
		}

		const definitions = schema.$defs || schema.definitions;

		// 2. If schema is in $defs or definitions, mark as standalone
		if (definitions) {
			for (const def of Object.values(definitions)) {
				standalone.add(def);
				visit(def);
			}
		}

		// 3. Traverse properties, items, etc.
		if (schema.properties) {
			for (const prop of Object.values(schema.properties)) {
				visit(prop);
			}
		}

		if (schema.patternProperties) {
			for (const prop of Object.values(schema.patternProperties)) {
				visit(prop);
			}
		}

		if (
			schema.additionalProperties &&
			typeof schema.additionalProperties === 'object'
		) {
			visit(schema.additionalProperties);
		}

		if (schema.items) {
			if (Array.isArray(schema.items)) {
				for (const item of schema.items) visit(item);
			} else {
				visit(schema.items);
			}
		}

		if (schema.additionalItems && typeof schema.additionalItems === 'object') {
			visit(schema.additionalItems);
		}

		if (schema.allOf) schema.allOf.forEach(visit);
		if (schema.anyOf) schema.anyOf.forEach(visit);
		if (schema.oneOf) schema.oneOf.forEach(visit);
		if (schema.not) visit(schema.not);

		if (schema.dependencies) {
			for (const dep of Object.values(schema.dependencies)) {
				if (typeof dep === 'object' && dep !== null && !Array.isArray(dep)) {
					visit(dep);
				}
			}
		}
	}

	visit(root);

	// Always include root as standalone
	standalone.add(root);

	return Array.from(standalone);
}
