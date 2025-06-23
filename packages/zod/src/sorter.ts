import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

/**
 * Returns standalone schemas in topological order (dependencies first).
 * Only schemas present in the input array are considered as nodes.
 */
export function sortSchemasByDependency(
	schemas: ParsedJSONSchemaObject[]
): ParsedJSONSchemaObject[] {
	const result: ParsedJSONSchemaObject[] = [];
	const visited = new Set<ParsedJSONSchemaObject>();

	function visit(schema: ParsedJSONSchemaObject) {
		if (visited.has(schema)) return;
		visited.add(schema);

		// Collect referenced schemas that are also in the input array
		const dependencies: ParsedJSONSchemaObject[] = [];

		// Reference via $ref
		if (schema[Meta]?.reference && schemas.includes(schema[Meta].reference)) {
			dependencies.push(schema[Meta].reference);
		}

		// $defs and definitions
		if (schema.$defs) {
			for (const def of Object.values(schema.$defs)) {
				if (schemas.includes(def)) dependencies.push(def);
			}
		}
		if (schema.definitions) {
			for (const def of Object.values(schema.definitions)) {
				if (schemas.includes(def)) dependencies.push(def);
			}
		}

		// Recursively visit dependencies
		for (const dep of dependencies) {
			visit(dep);
		}

		result.push(schema);
	}

	for (const schema of schemas) {
		visit(schema);
	}

	// Remove duplicates while preserving order
	return Array.from(new Set(result));
}
