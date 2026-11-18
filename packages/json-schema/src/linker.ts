import type { $Refs } from '@apidevtools/json-schema-ref-parser';

import { join as pathJoin, dirname } from 'path';

import { resolveDialect } from './dialect';
import type { SchemaIndex } from './identifiers';
import {
	Meta,
	type JSONSchema,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
	type Path,
} from './model';
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

export function link({
	schema,
	parent = null,
	path,
	$refs,
	identifiers,
	stack,
	filePath,
	fileName,
	dialects,
}: LinkNodeOptions): ParsedJSONSchemaObject {
	let pointer = [filePath, ...path].join('/');
	let reference = undefined;

	if (typeof schema !== 'object' || schema === null) {
		return schema as ParsedJSONSchemaObject;
	}

	const ref = typeof schema.$ref === 'string' ? schema.$ref : undefined;

	if (ref) {
		// `$id` establishes a base URI for its whole resource, so a `$ref` has
		// to be resolved against it rather than against the file that happens
		// to contain the schema.
		reference = identifiers.resolve(ref, identifiers.baseUriOf(schema) ?? filePath) as
			| ParsedJSONSchemaObject
			| undefined;

		if (reference === undefined) {
			if (filePath !== '#' && ref.startsWith('#')) {
				pointer = filePath + '#' + ref.slice(1);
			} else if (ref.startsWith('./')) {
				pointer = pathJoin(dirname(filePath), ref);
			} else {
				pointer = ref;
			}

			if ($refs.exists(pointer, {})) {
				reference = $refs.get(pointer) as unknown as ParsedJSONSchema;
				if (reference === undefined) {
					throw new Error(`Reference not found: ${pointer}`);
				}
			}
		}
	}

	if (
		reference !== undefined &&
		reference !== null &&
		typeof reference !== 'boolean' &&
		!Array.isArray(reference) &&
		!isPlainObject(reference)
	) {
		throw new Error(`Reference is not a valid object: ${pointer}`);
	}

	if (!reference && !Array.isArray(schema) && !isPlainObject(schema)) {
		return schema as ParsedJSONSchemaObject;
	}

	if (Object.hasOwnProperty.call(schema, Meta)) {
		return schema as unknown as ParsedJSONSchemaObject;
	}

	const meta: Meta = {
		filePath,
		fileName,
		path,
		parent: parent as ParsedJSONSchemaObject,
		...dialectMeta(schema, parent, dialects),
	};

	if (ref && reference !== undefined) {
		meta.reference = reference as ParsedJSONSchema;
		meta.isCircular = stack.has(reference as JSONSchema);

		Object.defineProperty(schema, Meta, {
			enumerable: false,
			value: meta,
			writable: false,
		});

		// A root `$ref` can carry sibling definitions (for example after the
		// playground bundles a remote file). Link them too.
		stack.add(schema);

		for (const [key, value] of Object.entries(schema)) {
			if (key === '$ref') {
				continue;
			}

			link({
				schema: value,
				parent: schema,
				path: [...path, key],
				filePath,
				$refs,
				identifiers,
				stack,
				fileName,
				dialects,
			});
		}

		stack.delete(schema);

		return schema as unknown as ParsedJSONSchemaObject;
	}

	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: meta,
		writable: false,
	});

	stack.add(schema);

	if (Array.isArray(schema)) {
		schema.forEach((item, index) =>
			link({
				schema: item,
				parent: schema,
				path: [...path, index],
				filePath,
				$refs,
				identifiers,
				stack,
				fileName,
				dialects,
			})
		);
	}

	for (const [key, value] of Object.entries(schema)) {
		link({
			schema: value,
			parent: schema,
			path: [...path, key],
			filePath,
			$refs,
			identifiers,
			stack,
			fileName,
			dialects,
		});
	}

	stack.delete(schema);

	return schema as unknown as ParsedJSONSchemaObject;
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
