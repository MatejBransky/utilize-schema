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
		indexIdentifiers(uri, schema, index, new WeakSet());
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
	if (typeof schema !== 'object' || schema === null) {
		return undefined;
	}

	const record = schema as Record<string, unknown>;

	if (typeof record.$id === 'string') {
		return record.$id;
	}

	// Draft-04 used `id`; the suite still exercises it under `*-legacy.json`.
	if (typeof record.id === 'string') {
		return record.id;
	}

	return undefined;
}

function indexIdentifiers(
	baseUri: string,
	schema: JSONSchema | boolean,
	index: Map<string, JSONSchema | boolean>,
	seen: WeakSet<object>
): void {
	if (typeof schema !== 'object' || schema === null || seen.has(schema)) {
		return;
	}

	seen.add(schema);

	const identifier = identifierOf(schema);
	let nextBase = baseUri;

	if (identifier) {
		const resolved = normalizeUri(identifier, baseUri);
		nextBase = resolved;

		if (!index.has(resolved)) {
			index.set(resolved, schema);
		}
	}

	for (const value of Object.values(schema)) {
		if (typeof value === 'object' && value !== null) {
			indexIdentifiers(nextBase, value as JSONSchema, index, seen);
		}
	}
}
