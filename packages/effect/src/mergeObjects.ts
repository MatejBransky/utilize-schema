import {
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { UnresolvedReferenceError } from './errors';
import { ANNOTATION_KEYWORDS } from './keywords';

/** Keywords an object subschema may use and still be merged into another one. */
const MERGEABLE_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties']);

export type MergeResult =
	| { merged: ParsedJSONSchemaObject | false }
	| { merged?: undefined; reason: string };

/**
 * Merges object subschemas into a single object schema, the way Effect
 * expresses an intersection. Returns `false` when a subschema is `false`, and a
 * reason instead of throwing when the subschemas cannot be merged, so callers
 * can choose between failing and another representation.
 */
export function mergeObjectSchemas(schemas: ParsedJSONSchema[]): MergeResult {
	const properties: Record<string, ParsedJSONSchema> = {};
	const required = new Set<string>();
	let additionalProperties: ParsedJSONSchemaObject['additionalProperties'];
	let additionalDeclared = false;

	for (const raw of schemas) {
		const dereferenced = dereference(raw);

		if (dereferenced === false) {
			return { merged: false };
		}

		if (!isPlainObject(dereferenced)) {
			return { reason: 'only object subschemas can be merged' };
		}

		const schema = dereferenced as ParsedJSONSchemaObject;
		const unmergeable = unmergeableReason(schema);

		if (unmergeable !== undefined) {
			return { reason: unmergeable };
		}

		for (const [key, property] of Object.entries(
			(schema.properties ?? {}) as Record<string, ParsedJSONSchema>
		)) {
			if (Object.hasOwn(properties, key)) {
				return { reason: `property ${JSON.stringify(key)} is declared by more than one subschema` };
			}

			properties[key] = property;
		}

		for (const key of schema.required ?? []) {
			if (typeof key === 'string') {
				required.add(key);
			}
		}

		const additional = schema.additionalProperties;

		if (additional !== undefined && additional !== true) {
			if (additionalDeclared && additionalProperties !== additional) {
				return {
					reason: 'every subschema would have to declare the same "additionalProperties"',
				};
			}

			additionalProperties = additional;
			additionalDeclared = true;
		}
	}

	const merged: Record<string, unknown> = {
		type: 'object',
		properties,
		required: [...required],
	};

	if (additionalDeclared) {
		merged.additionalProperties = additionalProperties;
	}

	return { merged: merged as unknown as ParsedJSONSchemaObject };
}

function unmergeableReason(schema: ParsedJSONSchemaObject): string | undefined {
	if (schema.type !== undefined && schema.type !== 'object') {
		return 'only object subschemas can be merged';
	}
	if (schema.$ref !== undefined) {
		return 'nested references cannot be merged';
	}

	const record = schema as unknown as Record<string, unknown>;
	const keyword = Object.keys(schema).find(
		(key) =>
			record[key] !== undefined && !ANNOTATION_KEYWORDS.has(key) && !MERGEABLE_KEYWORDS.has(key)
	);

	return keyword === undefined ? undefined : `${JSON.stringify(keyword)} cannot be merged`;
}

/** The target of a `$ref` node, or the node itself when it is not a reference. */
export function dereference(schema: ParsedJSONSchema): ParsedJSONSchema {
	if (!isPlainObject(schema) || typeof schema.$ref !== 'string') {
		return schema;
	}

	const resolved = (schema as ParsedJSONSchemaObject)[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(schema.$ref);
	}

	return resolved;
}
