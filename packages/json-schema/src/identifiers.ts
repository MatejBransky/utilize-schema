import type { JSONSchema } from './model';
import { isPlainObject } from './utils';

/**
 * Resolves JSON Schema identifiers (`$id`, `$anchor` and legacy fragment-only
 * `$id`) to the schema objects that declare them.
 *
 * `$RefParser` loads external resources and resolves JSON pointers, but it does
 * not treat a plain fragment such as `#name` as an identifier and it resolves
 * `$ref`s against the retrieval URI instead of the nearest `$id`. Bundled
 * schemas rely on both, so the linker asks this index first and falls back to
 * `$RefParser` for everything else.
 */
export interface SchemaIndex {
	/** The resource URI in effect for a schema node. */
	baseUriOf(node: unknown): string | undefined;
	/** Resolves a `$ref` against the base URI of the schema that contains it. */
	resolve(ref: string, baseUri: string): JSONSchema | boolean | undefined;
}

export function createSchemaIndex(): SchemaIndex & {
	addDocument(retrievalUri: string, root: JSONSchema): void;
} {
	const resources = new Map<string, JSONSchema | boolean>();
	const anchors = new Map<string, JSONSchema | boolean>();
	const bases = new WeakMap<object, string>();

	function addDocument(retrievalUri: string, root: JSONSchema) {
		if (typeof root === 'object' && root !== null) {
			resources.set(retrievalUri, root);
			bases.set(root, retrievalUri);
		}

		walk(root, retrievalUri);
	}

	function walk(node: unknown, baseUri: string) {
		if (Array.isArray(node)) {
			for (const item of node) {
				walk(item, baseUri);
			}
			return;
		}

		if (!isPlainObject(node)) {
			return;
		}

		let nextBase = baseUri;
		// In draft-07 `$ref` replaces the rest of the schema, including a
		// sibling `$id` or `$anchor`, so it must not change the base URI that the
		// reference itself is resolved against.
		const hasRef = typeof node.$ref === 'string';
		const id =
			!hasRef && typeof node.$id === 'string' && node.$id.length > 0 ? node.$id : undefined;

		if (id) {
			const hashIndex = id.indexOf('#');
			const resourcePart = hashIndex === -1 ? id : id.slice(0, hashIndex);
			const fragment = hashIndex === -1 ? '' : id.slice(hashIndex + 1);

			if (resourcePart) {
				nextBase = stripHash(resolveUri(baseUri, resourcePart));
				resources.set(nextBase, node);
			}

			// A non-empty fragment in `$id` is the draft-07 way to declare a
			// location-independent identifier; `$anchor` is the 2019-09+ form.
			if (fragment) {
				anchors.set(`${nextBase}#${fragment}`, node);
			}
		}

		if (!hasRef && typeof node.$anchor === 'string' && node.$anchor.length > 0) {
			anchors.set(`${nextBase}#${node.$anchor}`, node);
		}

		bases.set(node, nextBase);

		for (const child of schemaChildren(node)) {
			walk(child, nextBase);
		}
	}

	function resolve(ref: string, baseUri: string): JSONSchema | boolean | undefined {
		const absolute = resolveUri(baseUri, ref);
		const hashIndex = absolute.indexOf('#');
		const documentUri = hashIndex === -1 ? absolute : absolute.slice(0, hashIndex);
		const fragment = hashIndex === -1 ? '' : absolute.slice(hashIndex + 1);

		if (fragment) {
			const anchor = anchors.get(`${documentUri}#${fragment}`);

			if (anchor !== undefined) {
				return anchor;
			}
		}

		const resource = resources.get(documentUri);

		if (resource === undefined) {
			return undefined;
		}

		if (!fragment) {
			return resource;
		}

		if (!fragment.startsWith('/')) {
			return undefined;
		}

		return resolvePointer(resource, fragment);
	}

	return {
		addDocument,
		baseUriOf: (node) => (typeof node === 'object' && node !== null ? bases.get(node) : undefined),
		resolve,
	};
}

const MAP_KEYWORDS = new Set([
	'$defs',
	'definitions',
	'properties',
	'patternProperties',
	'dependentSchemas',
]);

const SINGLE_SCHEMA_KEYWORDS = new Set([
	'additionalProperties',
	'additionalItems',
	'contains',
	'propertyNames',
	'if',
	'then',
	'else',
	'not',
	'unevaluatedProperties',
	'unevaluatedItems',
	'contentSchema',
]);

const ARRAY_SCHEMA_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

/** Yields only schema-bearing children, so `$id` in `default` or `examples` is ignored. */
function* schemaChildren(node: Record<string, unknown>): Generator<unknown> {
	for (const [keyword, value] of Object.entries(node)) {
		if (keyword === 'items') {
			if (Array.isArray(value)) {
				yield* value;
			} else {
				yield value;
			}
			continue;
		}

		if (MAP_KEYWORDS.has(keyword) && isPlainObject(value)) {
			yield* Object.values(value);
			continue;
		}

		if (SINGLE_SCHEMA_KEYWORDS.has(keyword)) {
			yield value;
			continue;
		}

		if (ARRAY_SCHEMA_KEYWORDS.has(keyword) && Array.isArray(value)) {
			yield* value;
			continue;
		}

		if (keyword === 'dependencies' && isPlainObject(value)) {
			for (const dependency of Object.values(value)) {
				if (!Array.isArray(dependency)) {
					yield dependency;
				}
			}
		}
	}
}

function resolvePointer(root: JSONSchema | boolean, pointer: string) {
	let current: unknown = root;

	for (const rawToken of pointer.split('/')) {
		let token: string;

		try {
			token = decodeURIComponent(rawToken);
		} catch {
			token = rawToken;
		}

		token = token.replace(/~1/g, '/').replace(/~0/g, '~');

		if (typeof current !== 'object' || current === null || !Object.hasOwn(current, token)) {
			return undefined;
		}

		current = (current as Record<string, unknown>)[token];
	}

	return current as JSONSchema | boolean | undefined;
}

const PLACEHOLDER_ORIGIN = 'https://utilize.invalid';

/** Resolves `ref` against `base` the way a browser resolves a link. */
export function resolveUri(base: string, ref: string): string {
	// A URN or another opaque scheme is not a valid URL base for relative
	// references, but a fragment still resolves against it in JSON Schema.
	if (ref.startsWith('#') && !/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(base)) {
		return stripHash(base) + ref;
	}

	try {
		const from = new URL(normalizePath(base), PLACEHOLDER_ORIGIN);
		const resolved = new URL(normalizePath(ref), from);

		if (resolved.origin === PLACEHOLDER_ORIGIN) {
			return `${resolved.pathname}${resolved.search}${resolved.hash}`;
		}

		return resolved.href;
	} catch {
		// Opaque base URIs (for example a URN) cannot be used as a URL base.
		// Resolve absolute references directly and fall back to concatenation.
		try {
			return new URL(normalizePath(ref)).href;
		} catch {
			return stripHash(base) + ref;
		}
	}
}

function stripHash(uri: string) {
	const hashIndex = uri.indexOf('#');
	return hashIndex === -1 ? uri : uri.slice(0, hashIndex);
}

function normalizePath(value: string) {
	// A Windows drive path would otherwise read `c:` as a URL scheme.
	return /^[a-zA-Z]:[\\/]/.test(value) ? value.replace(/\\/g, '/') : value.replace(/\\/g, '/');
}
