import { Meta } from './model';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from './model';

/**
 * A dependency between two schemas: the first one needs the second. The first
 * is `null` for a schema that nothing orders, such as the root or a definition.
 */
export type SchemaEdge = [ParsedJSONSchemaObject | null, ParsedJSONSchemaObject];

export interface StandaloneSchemas {
	/** Every schema that gets its own declaration, the root included. */
	schemas: ParsedJSONSchemaObject[];
	/** The dependency edges between all visited schemas, in visit order. */
	edges: SchemaEdge[];
}

export interface CollectStandaloneSchemasOptions {
	/**
	 * Maps an inline copy of a standalone schema to that schema. A copy counts
	 * as a reference to it, so the copy's own subschemas are skipped.
	 */
	inlineCopies?: ReadonlyMap<ParsedJSONSchemaObject, ParsedJSONSchemaObject>;
	/**
	 * The `$defs`/`definitions` entries of a schema that get their own
	 * declaration. It is read lazily: each entry is visited before the next one
	 * is read. Defaults to the object entries of `$defs`, or of `definitions`
	 * when a schema has no `$defs`.
	 */
	definitionsOf?: (schema: ParsedJSONSchemaObject) => Iterable<ParsedJSONSchemaObject>;
}

/**
 * Collects all standalone schemas (referenced, `$defs`/`definitions` and the
 * root) and the dependency edges between them.
 */
export function collectStandaloneSchemas(
	root: ParsedJSONSchemaObject,
	{
		inlineCopies = new Map(),
		definitionsOf = firstDefinitionsOf,
	}: CollectStandaloneSchemasOptions = {}
): StandaloneSchemas {
	const standalone = new Set<ParsedJSONSchemaObject>();
	const seen = new Set<ParsedJSONSchemaObject>();
	const edges: SchemaEdge[] = [];

	function declare(schema: ParsedJSONSchemaObject, parent: ParsedJSONSchemaObject | null) {
		standalone.add(schema);
		visit(schema, parent);
	}

	function visit(schema: ParsedJSONSchema | undefined, parent: ParsedJSONSchemaObject | null) {
		if (!isSchemaObject(schema)) {
			return;
		}

		edges.push([parent, schema]);

		if (seen.has(schema)) {
			return;
		}
		seen.add(schema);

		const declaration = inlineCopies.get(schema);

		if (declaration) {
			declare(declaration, schema);
			return;
		}

		const reference = schema[Meta]?.reference;

		if (isSchemaObject(reference)) {
			declare(reference, schema);
		}

		// Definitions get their own declaration, so they are not ordered under
		// the schema that declares them: ordering must follow $ref edges only.
		for (const definition of definitionsOf(schema)) {
			declare(definition, null);
		}

		for (const child of childSchemasOf(schema)) {
			visit(child, schema);
		}
	}

	visit(root, null);
	standalone.add(root);

	return { schemas: Array.from(standalone), edges };
}

/** The default {@link CollectStandaloneSchemasOptions.definitionsOf}. */
function* firstDefinitionsOf(schema: ParsedJSONSchemaObject): Generator<ParsedJSONSchemaObject> {
	const definitions = schema.$defs || schema.definitions;

	if (!definitions) {
		return;
	}

	for (const definition of Object.values(definitions) as ParsedJSONSchema[]) {
		if (isSchemaObject(definition)) {
			yield definition;
		}
	}
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

	return children.filter(isSchemaObject);
}

function isSchemaObject(schema: unknown): schema is ParsedJSONSchemaObject {
	return typeof schema === 'object' && schema !== null;
}
