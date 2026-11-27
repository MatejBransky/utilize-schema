import { dialects } from './dialect';
import type { Dialect } from './dialect';
import { SCHEMA_ARRAY_KEYWORDS, SCHEMA_MAP_KEYWORDS, SINGLE_SCHEMA_KEYWORDS } from './keywords';
import { isJSONSchema, isJSONSchemaObject } from './model';
import type { JSONSchema } from './model';
import type { DialectMap } from './normalize';
import { isPlainObject } from './utils';

/**
 * Resolves JSON Schema identifiers (`$id`, `$anchor` and legacy fragment-only
 * `$id`) to the schema objects that declare them.
 *
 * `$RefParser` loads external resources, but it does not treat a plain fragment
 * such as `#name` as an identifier and it resolves `$ref`s against the
 * retrieval URI instead of the nearest `$id`. Bundled schemas rely on both, so
 * the linker asks this index first. The index also resolves JSON pointer
 * fragments (`#/definitions/a`) inside the resource the base URI names.
 *
 * The linker falls back to `$RefParser` only when the index finds nothing: for
 * example a pointer that passes through another `$ref` (`$RefParser` follows
 * it, the index does not), or a `$ref` inside a keyword the index does not
 * walk, whose base URI is therefore unknown. That fallback resolves against the
 * containing file, not the nearest `$id`.
 */
export interface SchemaIndex {
	/** The resource URI in effect for a schema node. */
	baseUriOf(node: unknown): string | undefined;
	/** Resolves a `$ref` against the base URI of the schema that contains it. */
	resolve(ref: string, baseUri: string): JSONSchema | boolean | undefined;
}

function identifierOf(
	node: JSONSchema,
	dialect: Dialect,
	ignoresSiblings: boolean
): string | undefined {
	const rawId = dialect.keywords.has('$id') ? node.$id : node.id;

	return !ignoresSiblings && typeof rawId === 'string' && rawId.length > 0 ? rawId : undefined;
}

export function createSchemaIndex(): SchemaIndex & {
	/**
	 * Indexes a document. `nodeDialects` comes from `prepareSchema`; without it
	 * every node is read as draft-07.
	 */
	addDocument(retrievalUri: string, root: JSONSchema | boolean, nodeDialects?: DialectMap): void;
} {
	const resources = new Map<string, JSONSchema | boolean>();
	const anchors = new Map<string, JSONSchema | boolean>();
	const bases = new WeakMap<object, string>();

	function addDocument(
		retrievalUri: string,
		root: JSONSchema | boolean,
		nodeDialects?: DialectMap
	) {
		resources.set(retrievalUri, root);

		if (typeof root === 'object' && root !== null) {
			bases.set(root, retrievalUri);
		}

		walk(root, retrievalUri, dialects['draft-07'], nodeDialects);
	}

	function walk(
		node: unknown,
		baseUri: string,
		inheritedDialect: Dialect,
		nodeDialects: DialectMap | undefined
	) {
		if (Array.isArray(node)) {
			for (const item of node) {
				walk(item, baseUri, inheritedDialect, nodeDialects);
			}
			return;
		}

		if (isJSONSchemaObject(node)) {
			indexNode(node, baseUri, inheritedDialect, nodeDialects);
		}
	}

	function indexNode(
		node: JSONSchema,
		baseUri: string,
		inheritedDialect: Dialect,
		nodeDialects: DialectMap | undefined
	) {
		const dialect = nodeDialects?.get(node)?.dialect ?? inheritedDialect;
		// In draft-07 and older `$ref` replaces the rest of the schema, including
		// a sibling `$id` or `$anchor`, so it must not change the base URI that the
		// reference itself is resolved against. 2019-09 and newer apply them.
		const ignoresSiblings = typeof node.$ref === 'string' && dialect.refSiblings === 'ignore';
		const id = identifierOf(node, dialect, ignoresSiblings);
		const nextBase = indexIdentifier(node, id, baseUri);

		indexAnchors(node, nextBase, ignoresSiblings);
		bases.set(node, nextBase);

		for (const child of schemaChildren(node)) {
			walk(child, nextBase, dialect, nodeDialects);
		}
	}

	function indexAnchors(node: JSONSchema, baseUri: string, ignoresSiblings: boolean): void {
		if (ignoresSiblings) {
			return;
		}

		if (typeof node.$anchor === 'string' && node.$anchor.length > 0) {
			anchors.set(`${baseUri}#${node.$anchor}`, node);
		}

		if (typeof node.$dynamicAnchor === 'string' && node.$dynamicAnchor.length > 0) {
			anchors.set(`${baseUri}#${node.$dynamicAnchor}`, node);
		}
	}

	function indexIdentifier(node: JSONSchema, id: string | undefined, baseUri: string): string {
		if (!id) {
			return baseUri;
		}

		const hashIndex = id.indexOf('#');
		const resourcePart = hashIndex === -1 ? id : id.slice(0, hashIndex);
		const fragment = hashIndex === -1 ? '' : id.slice(hashIndex + 1);
		let nextBase = baseUri;

		if (resourcePart) {
			nextBase = stripHash(resolveUri(baseUri, resourcePart));
			resources.set(nextBase, node);
		}

		// A non-empty fragment in `$id` (`id` in draft-04) is the draft-07 way
		// to declare a location-independent identifier; `$anchor` is the
		// 2019-09+ form.
		if (fragment) {
			anchors.set(`${nextBase}#${fragment}`, node);
		}

		return nextBase;
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

/**
 * Yields only schema-bearing children, so `$id` in `default` or `examples` is
 * ignored. Exported so every indexer walks the same keywords.
 */
export function* schemaChildren(node: JSONSchema): Generator<unknown> {
	for (const [keyword, value] of Object.entries(node)) {
		if (keyword === 'items') {
			yield* itemsChildren(value);
			continue;
		}

		if (SCHEMA_MAP_KEYWORDS.has(keyword) && isPlainObject(value)) {
			yield* Object.values(value);
			continue;
		}

		if (SINGLE_SCHEMA_KEYWORDS.has(keyword)) {
			yield value;
			continue;
		}

		if (SCHEMA_ARRAY_KEYWORDS.has(keyword) && Array.isArray(value)) {
			yield* value;
			continue;
		}

		if (keyword === 'dependencies' && isPlainObject(value)) {
			yield* dependencyChildren(value);
		}
	}
}

function* itemsChildren(value: unknown): Generator<unknown> {
	if (Array.isArray(value)) {
		yield* value;
	} else {
		yield value;
	}
}

function* dependencyChildren(value: Record<string, unknown>): Generator<unknown> {
	for (const dependency of Object.values(value)) {
		if (!Array.isArray(dependency)) {
			yield dependency;
		}
	}
}

/**
 * Resolves a JSON pointer such as `/definitions/a`. The pointer starts with a
 * `/`, so the empty token before it is skipped.
 */
function resolvePointer(root: JSONSchema | boolean, pointer: string) {
	let current: unknown = root;

	for (const rawToken of pointer.split('/').slice(1)) {
		let token: string;

		try {
			token = decodeURIComponent(rawToken);
		} catch {
			token = rawToken;
		}

		token = token.replaceAll('~1', '/').replaceAll('~0', '~');

		if (Array.isArray(current)) {
			const index = Number(token);

			if (!Number.isInteger(index) || !Object.hasOwn(current, index)) {
				return undefined;
			}

			current = current[index];
			continue;
		}

		if (isPlainObject(current) && Object.hasOwn(current, token)) {
			current = current[token];
			continue;
		}

		return undefined;
	}

	return isJSONSchema(current) ? current : undefined;
}

const PLACEHOLDER_ORIGIN = 'https://utilize.invalid';

/** Resolves `ref` against `base` the way a browser resolves a link. */
function resolveUri(base: string, ref: string): string {
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
	return /^[a-zA-Z]:[\\/]/.test(value) ? value.replaceAll('\\', '/') : value.replaceAll('\\', '/');
}
