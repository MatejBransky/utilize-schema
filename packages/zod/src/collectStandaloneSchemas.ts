import { type ParsedJSONSchema, type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

export type SchemaEdge = [ParsedJSONSchemaObject | null, ParsedJSONSchemaObject];

interface StandaloneSchemasResult {
	schemas: ParsedJSONSchemaObject[];
	edges: SchemaEdge[];
}

// Helper to collect all standalone schemas: referenced and $defs/definitions
export function collectStandaloneSchemas(root: ParsedJSONSchemaObject): StandaloneSchemasResult {
	const standalone = new Set<ParsedJSONSchemaObject>();
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

		const definitions = schema.$defs || schema.definitions;

		// 2. If schema is in $defs or definitions, mark as standalone.
		// Definitions get their own const, so they are not ordered under the
		// schema that declares them: ordering must follow $ref edges only.
		if (definitions) {
			for (const def of Object.values(definitions) as Array<ParsedJSONSchemaObject | boolean>) {
				if (typeof def === 'object' && def !== null) {
					standalone.add(def);
				}

				visit(def, null);
			}
		}

		// 3. Traverse properties, items, etc.
		for (const child of childSchemasOf(schema)) {
			visit(child, schema);
		}
	}

	visit(root, null);

	// Always include root as standalone
	standalone.add(root);

	return { schemas: Array.from(standalone), edges: Array.from(edges) };
}

/**
 * The subschemas of a schema that are generated as part of it: everything
 * except `$defs`/`definitions` and the target of a `$ref`.
 */
export function childSchemasOf(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] {
	const children: (ParsedJSONSchema | undefined)[] = [
		...Object.values(schema.properties ?? {}),
		...Object.values(schema.patternProperties ?? {}),
		schema.additionalProperties,
		...[schema.items].flat(),
		...(schema.prefixItems ?? []),
		schema.additionalItems,
		schema.contains,
		schema.propertyNames,
		schema.if as ParsedJSONSchema | undefined,
		schema.then as ParsedJSONSchema | undefined,
		schema.else as ParsedJSONSchema | undefined,
		...(schema.allOf ?? []),
		...(schema.anyOf ?? []),
		...(schema.oneOf ?? []),
		schema.not,
		...Object.values(schema.dependencies ?? {}).filter(
			(dependency): dependency is ParsedJSONSchemaObject => !Array.isArray(dependency)
		),
	];

	return children.filter(
		(child): child is ParsedJSONSchemaObject => typeof child === 'object' && child !== null
	);
}
