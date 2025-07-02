import type { $Refs } from '@apidevtools/json-schema-ref-parser';

import { join as pathJoin, dirname } from 'path';

import {
	Meta,
	type JSONSchema,
	type ParsedJSONSchemaObject,
	type Path,
} from './model';
import { isPlainObject } from './utils';

export interface LinkNodeOptions {
	schema: JSONSchema;
	parent: JSONSchema | null;
	path: Path;
	filePath: string;
	$refs: $Refs;
	stack: Set<JSONSchema>;
	fileName: string;
}

export function link({
	schema,
	parent = null,
	path,
	$refs,
	stack,
	filePath,
	fileName,
}: LinkNodeOptions): ParsedJSONSchemaObject {
	let pointer = [filePath, ...path].join('/');
	let reference = undefined;

	if (typeof schema !== 'object' || schema === null) {
		return schema as ParsedJSONSchemaObject;
	}

	if (schema.$ref) {
		if (filePath !== '#' && schema.$ref.startsWith('#')) {
			pointer = filePath + '#' + schema.$ref.slice(1);
		} else if (schema.$ref.startsWith('./')) {
			pointer = pathJoin(dirname(filePath), schema.$ref);
		} else {
			pointer = schema.$ref;
		}

		if ($refs.exists(pointer, {})) {
			reference = $refs.get(pointer) as unknown as ParsedJSONSchemaObject;
			if (reference === undefined) {
				throw new Error(`Reference not found: ${pointer}`);
			}
		}
	}

	if (reference && !Array.isArray(reference) && !isPlainObject(reference)) {
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
	};

	if (schema.$ref && $refs.exists(pointer, {})) {
		const referencedSchema = $refs.get(pointer) as JSONSchema;
		meta.reference = referencedSchema as ParsedJSONSchemaObject;
		meta.isCircular = stack.has(referencedSchema);

		Object.defineProperty(schema, Meta, {
			enumerable: false,
			value: meta,
			writable: false,
		});

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
				stack,
				fileName,
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
			stack,
			fileName,
		});
	}

	stack.delete(schema);

	return schema as unknown as ParsedJSONSchemaObject;
}
