import { detectDialect } from './dialect';
import type { Dialect } from './dialect';
import { dialects } from './dialect';
import { schemaChildren } from './identifiers';
import { isJSONSchema, isJSONSchemaObject } from './model';
import type { JSONSchema } from './model';
import type { RuntimeSchemaBundle } from './runtimeSchema';
import { isPlainObject } from './utils';

export type RuntimeSchema = JSONSchema | boolean;

export interface SchemaResource {
	readonly uri: string;
	readonly root: RuntimeSchema;
	readonly parent: SchemaResource | undefined;
	rootLocation: SchemaLocation | undefined;
	readonly dynamicAnchors: Map<string, SchemaLocation>;
	dialect: Dialect;
	validation: boolean;
	recursiveAnchor: boolean;
}

export interface SchemaLocation {
	readonly schema: RuntimeSchema;
	readonly baseUri: string;
	readonly resource: SchemaResource;
}

export interface ResolvedSchemaReference {
	readonly location: SchemaLocation;
	readonly fragment: string;
}

export interface ValidationIndex {
	resolve(ref: string, baseUri: string): ResolvedSchemaReference | undefined;
	child(parent: SchemaLocation, schema: unknown): SchemaLocation | undefined;
}

interface IdentifierResolution {
	readonly resource: SchemaResource;
	readonly baseUri: string;
	readonly fragment: string;
}

interface AdvancedSchema {
	readonly $anchor?: unknown;
	readonly $dynamicAnchor?: unknown;
	readonly $recursiveAnchor?: unknown;
}

interface PointerStep {
	readonly found: boolean;
	readonly value?: unknown;
}

const PLACEHOLDER_ORIGIN = 'https://utilize.invalid';
const VALIDATION_VOCABULARY = '/vocab/validation';

/** Indexes raw schema documents without parsing or normalizing their nodes. */
export function createValidationIndex(bundle: RuntimeSchemaBundle): ValidationIndex {
	const locations = new WeakMap<object, SchemaLocation>();
	const resources = new Map<string, SchemaResource>();
	const anchors = new Map<string, SchemaLocation>();
	const retrievalAliases = new Map<string, SchemaResource>();
	const uniqueResources = new Set<SchemaResource>();
	const fallback = dialects[bundle.dialect];

	function addDocument(retrievalUri: string, schema: unknown): void {
		if (!isJSONSchema(schema)) {
			return;
		}

		const normalized = normalizeUri(retrievalUri);
		const initial = createResource(normalized, schema, undefined);
		const location = walk(schema, normalized, initial, true);
		if (location === undefined) {
			return;
		}

		initial.rootLocation = location;
		resources.set(normalized, location.resource);
		retrievalAliases.set(retrievalUri, location.resource);
	}

	for (const [uri, schema] of Object.entries(bundle.documents)) {
		addDocument(uri, schema);
	}

	const rootResource = resourceForUri(bundle.rootUri);
	if (rootResource !== undefined) {
		retrievalAliases.set(bundle.rootUri, rootResource);
	}

	for (const resource of uniqueResources) {
		configureResource(resource);
	}

	function createResource(
		uri: string,
		root: RuntimeSchema,
		parent: SchemaResource | undefined
	): SchemaResource {
		const resource: SchemaResource = {
			uri,
			root,
			parent,
			rootLocation: undefined,
			dynamicAnchors: new Map(),
			dialect: parent?.dialect ?? fallback,
			validation: parent?.validation ?? true,
			recursiveAnchor: false,
		};
		resources.set(uri, resource);
		uniqueResources.add(resource);
		return resource;
	}

	function walk(
		schema: unknown,
		baseUri: string,
		inheritedResource: SchemaResource,
		documentRoot = false
	): SchemaLocation | undefined {
		if (!isJSONSchema(schema)) {
			return undefined;
		}

		if (typeof schema === 'boolean') {
			return schemaLocation(schema, inheritedResource);
		}

		const existing = locations.get(schema);
		if (existing !== undefined) {
			return existing;
		}

		const identifier = resolveIdentifier(schema, baseUri, inheritedResource, documentRoot);
		const { resource, baseUri: nextBase, fragment } = identifier;
		const location: SchemaLocation = { schema, baseUri: nextBase, resource };

		locations.set(schema, location);
		resource.rootLocation ??= location;
		if (fragment !== '') {
			anchors.set(anchorKey(nextBase, fragment), location);
		}
		indexAnchors(schema, location);

		for (const child of schemaChildren(schema)) {
			walk(child, nextBase, resource);
		}

		return location;
	}

	function resolveIdentifier(
		schema: JSONSchema,
		baseUri: string,
		inheritedResource: SchemaResource,
		documentRoot: boolean
	): IdentifierResolution {
		const dialect = effectiveDialect(schema, inheritedResource.dialect);
		const identifier = schemaIdentifier(schema, dialect);
		if (identifier === undefined) {
			return { resource: inheritedResource, baseUri, fragment: '' };
		}

		const [resourcePart, fragment] = splitIdentifier(resolveUri(baseUri, identifier));
		const changesResource = resourcePart !== '' && resourcePart !== baseUri;
		const resource = changesResource
			? createResource(resourcePart, schema, documentRoot ? undefined : inheritedResource)
			: inheritedResource;
		return { resource, baseUri: changesResource ? resourcePart : baseUri, fragment };
	}

	function indexAnchors(schema: JSONSchema, location: SchemaLocation): void {
		const advanced = schema as AdvancedSchema;
		for (const keyword of ['$anchor', '$dynamicAnchor'] as const) {
			const name = advanced[keyword];
			if (typeof name !== 'string' || name === '') {
				continue;
			}

			anchors.set(anchorKey(location.baseUri, name), location);
			if (keyword === '$dynamicAnchor') {
				location.resource.dynamicAnchors.set(name, location);
			}
		}

		if (advanced.$recursiveAnchor === true) {
			location.resource.recursiveAnchor = true;
		}
	}

	function schemaLocation(schema: RuntimeSchema, resource: SchemaResource): SchemaLocation {
		return { schema, baseUri: resource.uri, resource };
	}

	function configureResource(resource: SchemaResource): void {
		if (resource.parent !== undefined) {
			configureResource(resource.parent);
		}

		const inherited = resource.parent?.dialect ?? fallback;
		const validation = resource.parent?.validation ?? true;
		resource.dialect = dialectOfSchema(resource.root, resource.uri, inherited, new Set());
		resource.validation = validationEnabled(resource.root, resource.uri) ?? validation;
	}

	function dialectOfSchema(
		schema: RuntimeSchema,
		baseUri: string,
		inherited: Dialect,
		seen: Set<string>
	): Dialect {
		if (!isJSONSchemaObject(schema) || typeof schema.$schema !== 'string') {
			return inherited;
		}

		return dialectOfUri(schema.$schema, baseUri, inherited, seen);
	}

	function dialectOfUri(
		uri: string,
		baseUri: string,
		inherited: Dialect,
		seen: Set<string>
	): Dialect {
		const detected = detectDialect({ $schema: uri });
		if (detected !== undefined) {
			return detected.dialect;
		}

		const absolute = resolveUri(baseUri, uri);
		if (seen.has(absolute)) {
			return inherited;
		}

		seen.add(absolute);
		const meta = resolve(absolute, absolute)?.location.schema;
		if (!isJSONSchemaObject(meta) || typeof meta.$schema !== 'string') {
			return inherited;
		}

		return dialectOfUri(meta.$schema, absolute, inherited, seen);
	}

	function validationEnabled(schema: RuntimeSchema, baseUri: string): boolean | undefined {
		if (!isJSONSchemaObject(schema) || typeof schema.$schema !== 'string') {
			return undefined;
		}

		const meta = resolve(schema.$schema, baseUri)?.location.schema;
		if (!isPlainObject(meta) || !isPlainObject(meta.$vocabulary)) {
			return undefined;
		}

		return Object.entries(meta.$vocabulary).some(
			([uri, required]) => stripHash(uri).endsWith(VALIDATION_VOCABULARY) && required === true
		);
	}

	function resourceForUri(uri: string): SchemaResource | undefined {
		const normalized = normalizeUri(uri);
		return resources.get(normalized) ?? resources.get(stripHash(normalized));
	}

	function resolve(ref: string, baseUri: string): ResolvedSchemaReference | undefined {
		const hashIndex = ref.indexOf('#');
		const documentPart = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
		const alias = retrievalAliases.get(documentPart);
		const absolute =
			alias === undefined ? resolveUri(baseUri, ref) : withFragment(alias.uri, ref, hashIndex);
		const resource = resourceForUri(absolute);
		if (resource === undefined) {
			return undefined;
		}

		const fragment = fragmentOf(absolute);
		if (fragment === '') {
			return {
				location: resource.rootLocation ?? schemaLocation(resource.root, resource),
				fragment,
			};
		}

		const anchored = anchors.get(anchorKey(resource.uri, fragment));
		if (anchored !== undefined) {
			return { location: anchored, fragment };
		}

		if (!fragment.startsWith('/')) {
			return undefined;
		}

		const location = resolvePointer(resource, fragment);
		return location === undefined ? undefined : { location, fragment };
	}

	function pointerContext(
		value: unknown,
		context: SchemaLocation,
		indexed: WeakMap<object, SchemaLocation>
	): SchemaLocation {
		if (typeof value !== 'object' || value === null) {
			return context;
		}

		return indexed.get(value) ?? context;
	}

	function pointerLocation(
		value: unknown,
		context: SchemaLocation,
		indexed: WeakMap<object, SchemaLocation>
	): SchemaLocation | undefined {
		if (!isJSONSchema(value)) {
			return undefined;
		}

		if (typeof value === 'boolean') {
			return schemaLocation(value, context.resource);
		}

		return (
			indexed.get(value) ?? {
				schema: value,
				baseUri: context.baseUri,
				resource: context.resource,
			}
		);
	}

	function resolvePointer(resource: SchemaResource, pointer: string): SchemaLocation | undefined {
		let current: unknown = resource.root;
		let context = resource.rootLocation ?? schemaLocation(resource.root, resource);

		for (const token of pointer.slice(1).split('/')) {
			const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
			const next = pointerChild(current, key);
			if (!next.found) {
				return undefined;
			}

			current = next.value;
			context = pointerContext(current, context, locations);
		}

		return pointerLocation(current, context, locations);
	}

	return {
		resolve,
		child: (parent, schema) => {
			if (!isJSONSchema(schema)) {
				return undefined;
			}

			if (typeof schema === 'boolean') {
				return schemaLocation(schema, parent.resource);
			}

			return (
				locations.get(schema) ?? { schema, baseUri: parent.baseUri, resource: parent.resource }
			);
		},
	};
}

function splitIdentifier(uri: string): [string, string] {
	const hashIndex = uri.indexOf('#');
	if (hashIndex === -1) {
		return [uri, ''];
	}

	return [uri.slice(0, hashIndex), decodeFragment(uri.slice(hashIndex + 1))];
}

function identifierOf(schema: JSONSchema, dialect: Dialect): string | undefined {
	const identifier = dialect.keywords.has('$id') ? schema.$id : schema.id;
	return typeof identifier === 'string' && identifier !== '' ? identifier : undefined;
}

function effectiveDialect(schema: JSONSchema, inherited: Dialect): Dialect {
	return detectDialect(schema)?.dialect ?? inherited;
}

function schemaIdentifier(schema: JSONSchema, dialect: Dialect): string | undefined {
	if (typeof schema.$ref === 'string' && dialect.refSiblings === 'ignore') {
		return undefined;
	}

	return identifierOf(schema, dialect);
}

function pointerChild(value: unknown, token: string): PointerStep {
	if (Array.isArray(value)) {
		if (!/^(0|[1-9]\d*)$/.test(token)) {
			return { found: false };
		}

		const index = Number(token);
		return Object.hasOwn(value, index) ? { found: true, value: value[index] } : { found: false };
	}

	if (isPlainObject(value) && Object.hasOwn(value, token)) {
		return { found: true, value: value[token] };
	}

	return { found: false };
}

function anchorKey(uri: string, anchor: string): string {
	return `${stripHash(uri)}#${anchor}`;
}

function fragmentOf(uri: string): string {
	const hashIndex = uri.indexOf('#');
	return hashIndex === -1 ? '' : decodeFragment(uri.slice(hashIndex + 1));
}

function decodeFragment(fragment: string): string {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return fragment;
	}
}

function withFragment(uri: string, ref: string, hashIndex: number): string {
	return hashIndex === -1 ? uri : `${uri}${ref.slice(hashIndex)}`;
}

function stripHash(uri: string): string {
	const hashIndex = uri.indexOf('#');
	return hashIndex === -1 ? uri : uri.slice(0, hashIndex);
}

function normalizeUri(uri: string): string {
	return stripHash(resolveUri('', uri));
}

/** Resolves hierarchical and opaque URIs using the browser URL implementation. */
function resolveUri(baseUri: string, ref: string): string {
	if (ref.startsWith('#') && !/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(baseUri)) {
		return `${stripHash(baseUri)}${ref}`;
	}

	try {
		const base = new URL(baseUri, PLACEHOLDER_ORIGIN);
		const resolved = new URL(ref, base);
		if (resolved.origin === PLACEHOLDER_ORIGIN) {
			return `${resolved.pathname}${resolved.search}${resolved.hash}`;
		}

		return resolved.href;
	} catch {
		try {
			return new URL(ref).href;
		} catch {
			return `${stripHash(baseUri)}${ref}`;
		}
	}
}
