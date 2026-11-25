import type { $Refs } from '@apidevtools/json-schema-ref-parser';

import { join as pathJoin, dirname } from 'node:path';

import { resolveDialect } from './dialect';
import type { SchemaIndex } from './identifiers';
import { Meta } from './model';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject, Path } from './model';
import type { DialectMap } from './normalize';
import { isPlainObject } from './utils';

export interface LinkNodeOptions {
	schema: JSONSchema;
	parent: JSONSchema | null;
	path: Path;
	filePath: string;
	$refs: $Refs;
	identifiers: SchemaIndex;
	stack: Set<JSONSchema>;
	fileName: string;
	/**
	 * Dialects resolved by `prepareSchema`. A node it did not visit inherits
	 * the dialect of its parent.
	 */
	dialects?: DialectMap;
}

type LinkContext = Omit<LinkNodeOptions, 'schema' | 'parent' | 'path'>;

interface ResolvedReference {
	pointer: string;
	reference: ParsedJSONSchema | undefined;
}

export function link(options: LinkNodeOptions): ParsedJSONSchemaObject {
	const { schema, parent = null, path, ...context } = options;

	return linkNode(schema, parent, path, context);
}

function linkNode(
	schema: JSONSchema,
	parent: JSONSchema | null,
	path: Path,
	context: LinkContext
): ParsedJSONSchemaObject {
	if (!isObjectNode(schema)) {
		return schema as ParsedJSONSchemaObject;
	}

	const ref = typeof schema.$ref === 'string' ? schema.$ref : undefined;
	const { pointer, reference } = resolveReference(schema, ref, path, context);

	if (!isValidReference(reference)) {
		throw new Error(`Reference is not a valid object: ${pointer}`);
	}

	if (!reference && !Array.isArray(schema) && !isPlainObject(schema)) {
		return schema as ParsedJSONSchemaObject;
	}

	if (Object.hasOwn(schema, Meta)) {
		return schema as unknown as ParsedJSONSchemaObject;
	}

	const meta = createMeta(schema, parent, path, context);

	if (hasReference(ref, reference)) {
		meta.reference = reference;
		meta.isCircular = context.stack.has(reference as JSONSchema);
		defineMeta(schema, meta);

		return linkReferenceChildren(schema, path, context);
	}

	defineMeta(schema, meta);

	return linkChildren(schema, path, context);
}

function isObjectNode(schema: JSONSchema): boolean {
	return typeof schema === 'object' && schema !== null;
}

function hasReference(ref: string | undefined, reference: ParsedJSONSchema | undefined): boolean {
	return Boolean(ref) && reference !== undefined;
}

function resolveReference(
	schema: JSONSchema,
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
	let reference = context.identifiers.resolve(
		ref,
		context.identifiers.baseUriOf(schema) ?? context.filePath
	) as ParsedJSONSchema | undefined;

	if (reference === undefined) {
		pointer = fallbackPointer(ref, context.filePath);

		if (context.$refs.exists(pointer, {})) {
			reference = context.$refs.get(pointer) as unknown as ParsedJSONSchema;

			if (reference === undefined) {
				throw new Error(`Reference not found: ${pointer}`);
			}
		}
	}

	return { pointer, reference };
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

function isValidReference(reference: ParsedJSONSchema | undefined): boolean {
	return (
		reference === undefined ||
		reference === null ||
		typeof reference === 'boolean' ||
		Array.isArray(reference) ||
		isPlainObject(reference)
	);
}

function createMeta(
	schema: JSONSchema,
	parent: JSONSchema | null,
	path: Path,
	context: LinkContext
): Meta {
	return {
		filePath: context.filePath,
		fileName: context.fileName,
		path,
		parent: parent as ParsedJSONSchemaObject,
		...dialectMeta(schema, parent, context.dialects),
	};
}

function defineMeta(schema: JSONSchema, meta: Meta): void {
	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: meta,
		writable: false,
	});
}

function linkReferenceChildren(
	schema: JSONSchema,
	path: Path,
	context: LinkContext
): ParsedJSONSchemaObject {
	// A root `$ref` can carry sibling definitions (for example after the
	// playground bundles a remote file). Link them too.
	context.stack.add(schema);

	for (const [key, value] of Object.entries(schema as Record<string, JSONSchema>)) {
		if (key !== '$ref') {
			linkChild(value, schema, [...path, key], context);
		}
	}

	context.stack.delete(schema);

	return schema as unknown as ParsedJSONSchemaObject;
}

function linkChildren(
	schema: JSONSchema,
	path: Path,
	context: LinkContext
): ParsedJSONSchemaObject {
	context.stack.add(schema);

	if (Array.isArray(schema)) {
		schema.forEach((item: JSONSchema, index) => linkChild(item, schema, [...path, index], context));
	}

	for (const [key, value] of Object.entries(schema as Record<string, JSONSchema>)) {
		linkChild(value, schema, [...path, key], context);
	}

	context.stack.delete(schema);

	return schema as unknown as ParsedJSONSchemaObject;
}

function linkChild(schema: JSONSchema, parent: JSONSchema, path: Path, context: LinkContext): void {
	linkNode(schema, parent, path, context);
}

function dialectMeta(
	schema: JSONSchema,
	parent: JSONSchema | null,
	dialects: DialectMap | undefined
): Pick<Meta, 'dialect' | 'dialectSource'> {
	const prepared = dialects?.get(schema);

	if (prepared) {
		return { dialect: prepared.dialect.id, dialectSource: prepared.source };
	}

	const parentMeta = (parent as ParsedJSONSchemaObject | null)?.[Meta];

	if (parentMeta) {
		return { dialect: parentMeta.dialect, dialectSource: parentMeta.dialectSource };
	}

	const resolved = resolveDialect(schema);

	return { dialect: resolved.dialect.id, dialectSource: resolved.source };
}
