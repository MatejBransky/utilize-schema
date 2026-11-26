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

export function link(options: LinkNodeOptions): ParsedJSONSchemaObject {
	const { schema, parent = null, path, ...context } = options;
	const linkedParent = parent === null ? null : isParsedSchemaNode(parent) ? parent : null;
	const linked = linkNode(schema, linkedParent, path, context);

	if (!linked) {
		throw new TypeError('Expected a schema object');
	}

	return linked;
}

function linkNode(
	schema: unknown,
	parent: ParsedJSONSchemaObject | null,
	path: Path,
	context: LinkContext
): ParsedJSONSchemaObject | undefined {
	if (typeof schema !== 'object' || schema === null) {
		return undefined;
	}

	const node: SchemaNode = schema;

	const rawRef = Array.isArray(node) ? undefined : node.$ref;
	const ref = typeof rawRef === 'string' ? rawRef : undefined;
	const reference = resolveReference(node, ref, context);

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

/** The linker also annotates tuple arrays, which act as parents of their items. */
function isParsedSchemaNode(schema: SchemaNode): schema is ParsedJSONSchemaObject {
	return Object.hasOwn(schema, Meta);
}

function hasReference(ref: string | undefined, reference: SchemaReference | undefined): boolean {
	return Boolean(ref) && reference !== undefined;
}

function resolveReference(
	schema: SchemaNode,
	ref: string | undefined,
	context: LinkContext
): SchemaReference | undefined {
	if (!ref) {
		return undefined;
	}

	// `$id` establishes a base URI for its whole resource, so a `$ref` has
	// to be resolved against it rather than against the file that happens
	// to contain the schema.
	let reference: SchemaReference | undefined = context.identifiers.resolve(
		ref,
		context.identifiers.baseUriOf(schema) ?? context.filePath
	);

	if (reference === undefined) {
		const pointer = fallbackPointer(ref, context.filePath);

		if (context.$refs.exists(pointer, {})) {
			reference = referenceFromPointer(context.$refs.get(pointer), pointer);
		}
	}

	return reference;
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

	if (reference === null || typeof reference === 'boolean') {
		meta.reference = reference;
		return;
	}

	if (isParsedSchemaNode(reference)) {
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

function createMeta(
	schema: SchemaNode,
	parent: ParsedJSONSchemaObject | null,
	path: Path,
	context: LinkContext
): Meta {
	return {
		filePath: context.filePath,
		fileName: context.fileName,
		path,
		parent,
		...dialectMeta(schema, parent?.[Meta], context.dialects),
	};
}

function defineMeta(schema: SchemaNode, meta: Meta): asserts schema is ParsedJSONSchemaObject {
	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: meta,
		writable: false,
	});
}

function linkReferenceChildren(
	schema: ParsedJSONSchemaObject,
	path: Path,
	context: LinkContext
): void {
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

function linkChildren(schema: ParsedJSONSchemaObject, path: Path, context: LinkContext): void {
	context.stack.add(schema);

	if (Array.isArray(schema)) {
		schema.forEach((item, index) => linkChild(item, schema, [...path, index], context));
	}

	for (const [key, value] of Object.entries(schema)) {
		linkChild(value, schema, [...path, key], context);
	}

	context.stack.delete(schema);
}

function linkChild(
	schema: unknown,
	parent: ParsedJSONSchemaObject,
	path: Path,
	context: LinkContext
): void {
	linkNode(schema, parent, path, context);
}

function dialectMeta(
	schema: SchemaNode,
	parentMeta: Meta | undefined,
	dialects: DialectMap | undefined
): Pick<Meta, 'dialect' | 'dialectSource'> {
	const prepared = dialects?.get(schema);

	if (prepared) {
		return { dialect: prepared.dialect.id, dialectSource: prepared.source };
	}

	if (parentMeta) {
		return { dialect: parentMeta.dialect, dialectSource: parentMeta.dialectSource };
	}

	const resolved = resolveDialect(schema);

	return { dialect: resolved.dialect.id, dialectSource: resolved.source };
}
