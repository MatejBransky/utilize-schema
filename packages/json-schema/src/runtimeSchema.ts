import { dialectOf, isKeywordApplicable } from './dialect';
import { schemaChildren } from './identifiers';
import {
	isJSONSchemaObject,
	isParsedJSONSchema,
	isParsedJSONSchemaObject,
	Meta,
	sourceCatalogOf,
	sourceDocumentOf,
} from './model';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject } from './model';
import { allocateName } from './resolveName';
import { createRuntimeShape } from './runtimeShape';
import { isPlainObject } from './utils';

/** Self-contained documents consumed by the generated runtime validator. */
export interface RuntimeSchemaBundle {
	rootUri: string;
	documents: Record<string, JSONSchema | boolean>;
	dialect: '2019-09' | '2020-12';
}

export interface RuntimeGuard {
	/** Validation-free target schema used for inference, shape and transformations. */
	shape: ParsedJSONSchema;
	bundle: RuntimeSchemaBundle;
	/** Retrieval URI plus JSON pointer for one standalone schema. */
	refFor(schema: ParsedJSONSchema): string;
}

const VALIDATION_VOCABULARY = '/vocab/validation';

/** Allocates private decoder names and the shared validator for guarded modules. */
export function allocateRuntimeNames(
	runtimeGuard: RuntimeGuard | undefined,
	schemas: ParsedJSONSchemaObject[],
	nameOf: (schema: ParsedJSONSchemaObject) => string,
	typeNames: Set<string>,
	usedNames: Set<string>
) {
	const internalNames = new Map<ParsedJSONSchemaObject, string>();

	if (!runtimeGuard) {
		return { internalNames, validatorName: undefined };
	}

	const validatorName = allocateName('jsonSchemaValidate', usedNames);

	for (const schema of schemas) {
		const internal = allocateName(`${nameOf(schema)}Shape`, usedNames);
		internalNames.set(schema, internal);
		typeNames.add(internal);
	}

	return { internalNames, validatorName };
}

/**
 * Creates the extra runtime validation needed for keywords whose semantics
 * depend on evaluation context: dynamic references and unevaluated annotations.
 * Returns `undefined` when the native generators can validate the whole schema.
 */
export function createRuntimeGuard(root: ParsedJSONSchema): RuntimeGuard | undefined {
	if (typeof root !== 'object' || root === null) {
		return undefined;
	}

	const source = sourceDocumentOf(root)?.schema ?? root;
	const customDialect =
		isPlainObject(source) &&
		typeof source.$schema === 'string' &&
		!isStandardDialectUri(source.$schema);
	const needsRuntimeKeywords = requiresRuntimeGuard(root);

	if (!needsRuntimeKeywords && !customDialect) {
		return undefined;
	}

	const documents = collectDocuments(root);
	const needsGuard = needsRuntimeKeywords || disablesValidationVocabulary(root, documents);

	if (!needsGuard) {
		return undefined;
	}

	const validationEnabled = validationVocabularyPredicate(root, documents);
	const rootUri = documentUri(root);
	const bundle: RuntimeSchemaBundle = {
		rootUri,
		documents: Object.fromEntries(documents),
		dialect: runtimeDialect(root, documents),
	};

	return {
		shape: createRuntimeShape(root, validationEnabled),
		bundle,
		refFor: (schema) => schemaReference(root, schema),
	};
}

/** Cheap raw-schema check used before the parser captures source documents. */
export function mayRequireRuntimeGuard(root: JSONSchema | boolean): boolean {
	const seen = new Set<object>();

	function visit(node: unknown): boolean {
		if (Array.isArray(node)) {
			return node.some(visit);
		}

		if (!isJSONSchemaObject(node) || seen.has(node)) {
			return false;
		}

		seen.add(node);

		if (hasRawRuntimeKeyword(node)) {
			return true;
		}

		return Array.from(schemaChildren(node)).some(visit);
	}

	return visit(root);
}

function hasRawRuntimeKeyword(node: JSONSchema): boolean {
	return (
		typeof node.$recursiveRef === 'string' ||
		typeof node.$dynamicRef === 'string' ||
		node.unevaluatedProperties !== undefined ||
		node.unevaluatedItems !== undefined ||
		(typeof node.$schema === 'string' && !isStandardDialectUri(node.$schema))
	);
}

function isStandardDialectUri(uri: string): boolean {
	return uri.includes('json-schema.org/draft/') || uri.includes('json-schema.org/draft-');
}

function requiresRuntimeGuard(root: ParsedJSONSchemaObject): boolean {
	const seen = new Set<object>();

	function visit(node: ParsedJSONSchema | undefined): boolean {
		if (typeof node !== 'object' || node === null || seen.has(node)) {
			return false;
		}

		seen.add(node);

		if (hasRuntimeKeyword(node) || visit(node[Meta]?.reference)) {
			return true;
		}

		return Array.from(schemaChildren(node)).some(
			(child) => isParsedJSONSchema(child) && visit(child)
		);
	}

	return visit(root);
}

function hasRuntimeKeyword(node: ParsedJSONSchemaObject): boolean {
	const dialect = dialectOf(node);
	const recursive =
		typeof node.$recursiveRef === 'string' && isKeywordApplicable(dialect, '$recursiveRef');
	const dynamic =
		typeof node.$dynamicRef === 'string' && isKeywordApplicable(dialect, '$dynamicRef');
	const unevaluated =
		(node.unevaluatedProperties !== undefined || node.unevaluatedItems !== undefined) &&
		(dialect.unevaluated || node[Meta]?.dialectSource === 'fallback');

	return recursive || dynamic || unevaluated;
}

function validationVocabularyPredicate(
	root: ParsedJSONSchemaObject,
	documents: Map<string, JSONSchema | boolean>
): (node: ParsedJSONSchemaObject) => boolean {
	const enabled = new WeakMap<ParsedJSONSchemaObject, boolean>();
	const seen = new Set<ParsedJSONSchemaObject>();

	function visit(node: ParsedJSONSchemaObject, inherited: boolean): void {
		if (seen.has(node)) {
			return;
		}

		seen.add(node);

		const current =
			typeof node.$schema === 'string'
				? (validationVocabularyFor(node.$schema, documents) ?? inherited)
				: inherited;
		enabled.set(node, current);

		if (typeof node[Meta]?.reference === 'object' && node[Meta].reference !== null) {
			visit(node[Meta].reference, current);
		}

		for (const child of schemaChildren(node)) {
			if (isParsedJSONSchemaObject(child)) {
				visit(child, current);
			}
		}
	}

	visit(root, true);

	return (node) => enabled.get(node) ?? true;
}

function validationVocabularyFor(
	uri: string,
	documents: Map<string, JSONSchema | boolean>
): boolean | undefined {
	const meta = metaSchemaFor(uri, documents);

	if (!isPlainObject(meta) || !isPlainObject(meta.$vocabulary)) {
		return undefined;
	}

	return Object.entries(meta.$vocabulary).some(
		([vocabulary, required]) => vocabulary.endsWith(VALIDATION_VOCABULARY) && required === true
	);
}

function disablesValidationVocabulary(
	root: ParsedJSONSchemaObject,
	documents: Map<string, JSONSchema | boolean>
): boolean {
	const schema = sourceDocumentOf(root)?.schema ?? root;

	return (
		isPlainObject(schema) &&
		typeof schema.$schema === 'string' &&
		validationVocabularyFor(schema.$schema, documents) === false
	);
}

function runtimeDialect(
	root: ParsedJSONSchemaObject,
	documents: Map<string, JSONSchema | boolean>
): RuntimeSchemaBundle['dialect'] {
	const source = sourceDocumentOf(root)?.schema ?? root;
	const declared = schemaUri(source);
	const meta = declared === undefined ? undefined : metaSchemaFor(declared, documents);
	const metaDialect = schemaUri(meta);

	return (
		dialectFromUri(metaDialect) ??
		dialectFromUri(declared) ??
		(dialectOf(root).id === '2019-09' ? '2019-09' : '2020-12')
	);
}

function schemaUri(schema: unknown): string | undefined {
	return isPlainObject(schema) && typeof schema.$schema === 'string' ? schema.$schema : undefined;
}

function dialectFromUri(uri: string | undefined): RuntimeSchemaBundle['dialect'] | undefined {
	if (uri?.includes('2020-12')) {
		return '2020-12';
	}

	return uri?.includes('2019-09') ? '2019-09' : undefined;
}

function metaSchemaFor(
	uri: string,
	documents: Map<string, JSONSchema | boolean>
): JSONSchema | boolean | undefined {
	for (const schema of documents.values()) {
		if (isPlainObject(schema)) {
			const id = typeof schema.$id === 'string' ? schema.$id : schema.id;

			if (id === uri) {
				return schema;
			}
		}
	}

	return documents.get(uri);
}

function collectDocuments(root: ParsedJSONSchemaObject): Map<string, JSONSchema | boolean> {
	const documents = new Map<string, JSONSchema | boolean>();

	for (const document of sourceCatalogOf(root) ?? []) {
		documents.set(document.uri, document.schema);
	}

	const seen = new Set<object>();

	function visit(node: ParsedJSONSchema | undefined): void {
		if (typeof node !== 'object' || node === null || seen.has(node)) {
			return;
		}

		seen.add(node);

		registerDocument(node);
		visit(node[Meta]?.reference);
		visitChildren(node);
	}

	function registerDocument(node: ParsedJSONSchemaObject): void {
		const documentRoot = rootOfDocument(node);
		const source = sourceDocumentOf(documentRoot);
		const schema = source?.schema ?? documentRoot;

		documents.set(source?.uri ?? documentUri(documentRoot), schema);
	}

	function visitChildren(node: ParsedJSONSchemaObject): void {
		for (const child of schemaChildren(node)) {
			if (isParsedJSONSchema(child)) {
				visit(child);
			}
		}
	}

	visit(root);

	return documents;
}

function rootOfDocument(node: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	const seen = new Set<ParsedJSONSchemaObject>();
	let current = node;

	while (!seen.has(current)) {
		const parent = current[Meta]?.parent;

		if (!parent || typeof parent !== 'object') {
			break;
		}

		seen.add(current);
		current = parent;
	}

	return current;
}

function documentUri(node: ParsedJSONSchema): string {
	if (typeof node !== 'object' || node === null) {
		return '';
	}

	const source = sourceDocumentOf(rootOfDocument(node));

	return stripHash(source?.uri ?? node[Meta]?.filePath ?? '#');
}

function schemaReference(root: ParsedJSONSchema, schema: ParsedJSONSchema): string {
	const uri = schema === root ? documentUri(root) : documentUri(schema);

	if (typeof schema !== 'object' || schema === null) {
		return uri;
	}

	const pointer = schema[Meta]?.path?.map(pointerToken).join('/') ?? '';

	return pointer === '' ? uri : `${uri}#/${pointer}`;
}

function pointerToken(token: string | number): string {
	return encodeURIComponent(String(token).replaceAll('~', '~0').replaceAll('/', '~1'));
}

function stripHash(uri: string): string {
	const index = uri.indexOf('#');

	return index === -1 ? uri : uri.slice(0, index);
}
