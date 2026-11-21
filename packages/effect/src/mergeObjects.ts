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

const additionalPropertiesReason =
	'"additionalProperties" does not consider properties declared by another subschema';

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
	// Without a prototype, `properties.__proto__ = ...` adds a property instead
	// of replacing the prototype.
	const properties: Record<string, ParsedJSONSchema> = Object.create(null);
	const propertyOwners = new Map<string, number>();
	const required = new Set<string>();
	let additionalProperties: ParsedJSONSchemaObject['additionalProperties'];
	let additionalOwner: number | undefined;
	let additionalDeclared = false;

	for (const [index, raw] of schemas.entries()) {
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

		const declaredProperties = Object.entries(
			(schema.properties ?? {}) as Record<string, ParsedJSONSchema>
		);

		// `additionalProperties` only considers the `properties` declared next to
		// it, so merging it with properties from another subschema would accept
		// keys the schema rejects.
		if (additionalDeclared && additionalOwner !== index && declaredProperties.length > 0) {
			return { reason: additionalPropertiesReason };
		}

		for (const [key, property] of declaredProperties) {
			if (Object.hasOwn(properties, key)) {
				return { reason: `property ${JSON.stringify(key)} is declared by more than one subschema` };
			}

			properties[key] = property;
			propertyOwners.set(key, index);
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

			if ([...propertyOwners.values()].some((owner) => owner !== index)) {
				return { reason: additionalPropertiesReason };
			}

			additionalProperties = additional;
			additionalOwner = index;
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
function dereference(schema: ParsedJSONSchema): ParsedJSONSchema {
	if (!isPlainObject(schema) || typeof schema.$ref !== 'string') {
		return schema;
	}

	const resolved = (schema as ParsedJSONSchemaObject)[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(schema.$ref);
	}

	return resolved;
}
