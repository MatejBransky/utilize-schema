import type { $Refs } from '@apidevtools/json-schema-ref-parser';

import { join as pathJoin, dirname } from 'path';

import { resolveDialect } from './dialect';
import type { SchemaIndex } from './identifiers';
import { isJSONSchemaObject, isParsedJSONSchemaObject, Meta } from './model';
import type { JSONSchema, ParsedJSONSchemaObject, Path } from './model';
import type { DialectMap } from './normalize';

export interface LinkNodeOptions {
	schema: JSONSchema;
	parent: JSONSchema | null;
	path: Path;
	filePath: string;
	$refs: $Refs;
	identifiers: SchemaIndex;
	stack: Set<object>;
	fileName: string;
	/**
	 * Dialects resolved by `prepareSchema`. A node it did not visit inherits
	 * the dialect of its parent.
	 */
	dialects?: DialectMap;
}

type LinkContext = Omit<LinkNodeOptions, 'schema' | 'parent' | 'path'>;

type SchemaNode = JSONSchema | unknown[];
type SchemaReference = JSONSchema | boolean | null;

interface ResolvedReference {
	pointer: string;
	reference: SchemaReference | undefined;
}

export function link(options: LinkNodeOptions): ParsedJSONSchemaObject {
	const { schema, parent = null, path, ...context } = options;
	const linked = linkNode(schema, parent, path, context);

	if (!linked) {
		throw new TypeError('Expected a schema object');
	}

	return linked;
}

function linkNode(
	schema: unknown,
	parent: SchemaNode | null,
	path: Path,
	context: LinkContext
): ParsedJSONSchemaObject | undefined {
	const node = schemaNode(schema);

	if (!node) {
		return undefined;
	}

	const rawRef = isJSONSchemaObject(node) ? node.$ref : undefined;
	const ref = typeof rawRef === 'string' ? rawRef : undefined;
	const { pointer, reference } = resolveReference(node, ref, path, context);

	if (!isValidReference(reference)) {
		throw new Error(`Reference is not a valid object: ${pointer}`);
	}

	if (isParsedSchemaNode(node)) {
		return node;
	}

	const meta = createMeta(node, parent, path, context);
	const references = hasReference(ref, reference);

	if (references) {
		setReference(meta, reference);
		meta.isCircular = isJSONSchemaObject(reference) && context.stack.has(reference);
	}

	defineMeta(node, meta);

	if (references) {
		linkReferenceChildren(node, path, context);
	} else {
		linkChildren(node, path, context);
	}

	return node;
}

function schemaNode(value: unknown): SchemaNode | undefined {
	if (isJSONSchemaObject(value) || Array.isArray(value)) {
		return value;
	}

	return undefined;
}

/** The linker also annotates tuple arrays, which act as parents of their items. */
function isParsedSchemaNode(schema: SchemaNode | null): schema is ParsedJSONSchemaObject {
	return (
		schema !== null &&
		(isParsedJSONSchemaObject(schema) || (Array.isArray(schema) && Object.hasOwn(schema, Meta)))
	);
}

function hasReference(ref: string | undefined, reference: SchemaReference | undefined): boolean {
	return Boolean(ref) && reference !== undefined;
}

function resolveReference(
	schema: SchemaNode,
	ref: string | undefined,
	path: Path,
	context: LinkContext
): ResolvedReference {
	let pointer = [context.filePath, ...path].join('/');

	if (!ref) {
		return { pointer, reference: undefined };
	}

	// `$id` establishes a base URI for its whole resource, so a `$ref` has
	// to be resolved against it rather than against the file that happens
	// to contain the schema.
	let reference: SchemaReference | undefined = context.identifiers.resolve(
		ref,
		context.identifiers.baseUriOf(schema) ?? context.filePath
	);

	if (reference === undefined) {
		pointer = fallbackPointer(ref, context.filePath);

		if (context.$refs.exists(pointer, {})) {
			reference = referenceFromPointer(context.$refs.get(pointer), pointer);
		}
	}

	return { pointer, reference };
}

function referenceFromPointer(value: unknown, pointer: string): SchemaReference {
	if (value === null || isJSONSchemaObject(value)) {
		return value;
	}

	throw new Error(`Reference is not a valid object: ${pointer}`);
}

/** Keeps a forward reference honest until the linker annotates its target. */
function setReference(meta: Meta, reference: SchemaReference | undefined): void {
	if (reference === undefined) {
		return;
	}

	if (!isJSONSchemaObject(reference) || isParsedJSONSchemaObject(reference)) {
		meta.reference = reference;
		return;
	}

	Object.defineProperty(meta, 'reference', {
		enumerable: true,
		configurable: true,
		get: (): ParsedJSONSchemaObject => {
			if (!isParsedJSONSchemaObject(reference)) {
				throw new Error('Reference target has not been linked');
			}

			return reference;
		},
	});
}

function fallbackPointer(ref: string, filePath: string): string {
	if (filePath !== '#' && ref.startsWith('#')) {
		return filePath + '#' + ref.slice(1);
	}

	if (ref.startsWith('./')) {
		return pathJoin(dirname(filePath), ref);
	}

	return ref;
}

function isValidReference(reference: SchemaReference | undefined): boolean {
	return (
		reference === undefined ||
		reference === null ||
		typeof reference === 'boolean' ||
		isJSONSchemaObject(reference)
	);
}

function createMeta(
	schema: SchemaNode,
	parent: SchemaNode | null,
	path: Path,
	context: LinkContext
): Meta {
	return {
		filePath: context.filePath,
		fileName: context.fileName,
		path,
		parent: isParsedSchemaNode(parent) ? parent : null,
		...dialectMeta(schema, parent, context.dialects),
	};
}

function defineMeta(schema: SchemaNode, meta: Meta): asserts schema is ParsedJSONSchemaObject {
	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: meta,
		writable: false,
	});
}

function linkReferenceChildren(schema: SchemaNode, path: Path, context: LinkContext): void {
	// A root `$ref` can carry sibling definitions (for example after the
	// playground bundles a remote file). Link them too.
	context.stack.add(schema);

	for (const [key, value] of Object.entries(schema)) {
		if (key !== '$ref') {
			linkChild(value, schema, [...path, key], context);
		}
	}

	context.stack.delete(schema);
}

function linkChildren(schema: SchemaNode, path: Path, context: LinkContext): void {
	context.stack.add(schema);

	if (Array.isArray(schema)) {
		schema.forEach((item, index) => linkChild(item, schema, [...path, index], context));
	}

	for (const [key, value] of Object.entries(schema)) {
		linkChild(value, schema, [...path, key], context);
	}

	context.stack.delete(schema);
}

function linkChild(schema: unknown, parent: SchemaNode, path: Path, context: LinkContext): void {
	linkNode(schema, parent, path, context);
}

function dialectMeta(
	schema: SchemaNode,
	parent: SchemaNode | null,
	dialects: DialectMap | undefined
): Pick<Meta, 'dialect' | 'dialectSource'> {
	const prepared = dialects?.get(schema);

	if (prepared) {
		return { dialect: prepared.dialect.id, dialectSource: prepared.source };
	}

	const parentMeta = isParsedSchemaNode(parent) ? parent[Meta] : undefined;

	if (parentMeta) {
		return { dialect: parentMeta.dialect, dialectSource: parentMeta.dialectSource };
	}

	const resolved = resolveDialect(schema);

	return { dialect: resolved.dialect.id, dialectSource: resolved.source };
}
