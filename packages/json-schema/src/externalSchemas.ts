import { resolveDialect } from './dialect';
import type { Dialect } from './dialect';
import { schemaChildren } from './identifiers';
import { isJSONSchemaObject } from './model';
import type { JSONSchema } from './model';

/** Documents served for absolute `$ref` URIs, keyed by retrieval URI. */
export type ExternalSchemas = Record<string, JSONSchema | boolean>;

/**
 * Indexes caller-provided documents by retrieval URI so the `$ref` resolver can
 * serve them without a file or network read. Identifiers declared inside a
 * document (`$id`, or the draft-04 `id`) are indexed too, because a `$ref` may
 * point at a nested identifier rather than at the document URI.
 *
 * Explicit keys win over nested identifiers when both resolve to the same URI.
 */
export function indexExternalSchemas(schemas: ExternalSchemas): Map<string, JSONSchema | boolean> {
	const index = new Map<string, JSONSchema | boolean>();

	// Parsing annotates documents in place, so clone them: the caller's map can
	// be compiled again, with another dialect, without leftovers.
	const documents = Object.entries(schemas).map(
		([uri, schema]) => [normalizeUri(uri), structuredClone(schema)] as const
	);

	for (const [uri, schema] of documents) {
		index.set(uri, schema);
	}

	for (const [uri, schema] of documents) {
		indexIdentifiers(uri, schema, index, new WeakSet(), resolveDialect(schema).dialect);
	}

	return index;
}

/** Resolves a URI against a base and normalizes it; returns the input when it cannot be parsed. */
export function normalizeUri(uri: string, base?: string): string {
	try {
		return new URL(uri, base).href;
	} catch {
		return uri;
	}
}

function identifierOf(schema: JSONSchema | boolean): string | undefined {
	if (!isJSONSchemaObject(schema)) {
		return undefined;
	}

	if (typeof schema.$id === 'string') {
		return schema.$id;
	}

	// Draft-04 used `id`; the suite still exercises it under `*-legacy.json`.
	if (typeof schema.id === 'string') {
		return schema.id;
	}

	return undefined;
}

function indexIdentifiers(
	baseUri: string,
	schema: JSONSchema | boolean,
	index: Map<string, JSONSchema | boolean>,
	seen: WeakSet<object>,
	dialect: Dialect
): void {
	if (!isJSONSchemaObject(schema) || seen.has(schema)) {
		return;
	}

	seen.add(schema);

	const nodeDialect = typeof schema.$schema === 'string' ? resolveDialect(schema).dialect : dialect;
	// In draft-07 and older `$ref` replaces the rest of the schema, so a sibling
	// `$id` does not declare a resource there. The linker makes the same check.
	const ignoresSiblings = typeof schema.$ref === 'string' && nodeDialect.refSiblings === 'ignore';
	const identifier = ignoresSiblings ? undefined : identifierOf(schema);
	const nextBase = registerIdentifier(identifier, baseUri, schema, index);

	for (const value of schemaChildren(schema)) {
		if (isJSONSchemaObject(value)) {
			indexIdentifiers(nextBase, value, index, seen, nodeDialect);
		}
	}
}

function registerIdentifier(
	identifier: string | undefined,
	baseUri: string,
	schema: JSONSchema,
	index: Map<string, JSONSchema | boolean>
): string {
	if (!identifier) {
		return baseUri;
	}

	const resolved = normalizeUri(identifier, baseUri);

	if (!index.has(resolved)) {
		index.set(resolved, schema);
	}

	return resolved;
}
