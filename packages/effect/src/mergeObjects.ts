import { isPlainObject, Meta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { UnresolvedReferenceError } from './errors';
import { ANNOTATION_KEYWORDS } from './keywords';

/** Keywords an object subschema may use and still be merged into another one. */
const MERGEABLE_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties']);

const additionalPropertiesReason =
	'"additionalProperties" does not consider properties declared by another subschema';

export type MergeResult =
	| { merged: ParsedJSONSchemaObject | false }
	| { merged?: undefined; reason: string };

interface MergeState {
	properties: Record<string, ParsedJSONSchema>;
	propertyOwners: Map<string, number>;
	required: Set<string>;
	additionalProperties: ParsedJSONSchemaObject['additionalProperties'];
	additionalOwner: number | undefined;
	additionalDeclared: boolean;
}

type MergeMember =
	| { kind: 'object'; schema: ParsedJSONSchemaObject }
	| { kind: 'false' }
	| { kind: 'reason'; reason: string };

/**
 * Merges object subschemas into a single object schema, the way Effect
 * expresses an intersection. Returns `false` when a subschema is `false`, and a
 * reason instead of throwing when the subschemas cannot be merged, so callers
 * can choose between failing and another representation.
 */
export function mergeObjectSchemas(schemas: ParsedJSONSchema[]): MergeResult {
	const state = createMergeState();

	for (const [index, raw] of schemas.entries()) {
		const member = mergeableObject(raw);

		if (member.kind === 'false') {
			return { merged: false };
		}

		if (member.kind === 'reason') {
			return { reason: member.reason };
		}

		const reason = mergeObjectMember(state, member.schema, index);

		if (reason !== undefined) {
			return { reason };
		}
	}

	return { merged: mergedObject(state) };
}

function createMergeState(): MergeState {
	// Without a prototype, `properties.__proto__ = ...` adds a property instead
	// of replacing the prototype.
	const properties: MergeState['properties'] = {};
	Object.setPrototypeOf(properties, null);

	return {
		properties,
		propertyOwners: new Map(),
		required: new Set(),
		additionalProperties: undefined,
		additionalOwner: undefined,
		additionalDeclared: false,
	};
}

function mergeableObject(raw: ParsedJSONSchema): MergeMember {
	const dereferenced = dereference(raw);

	if (dereferenced === false) {
		return { kind: 'false' };
	}

	if (!isPlainObject(dereferenced)) {
		return { kind: 'reason', reason: 'only object subschemas can be merged' };
	}

	const schema = dereferenced as ParsedJSONSchemaObject;
	const reason = unmergeableReason(schema);

	return reason === undefined ? { kind: 'object', schema } : { kind: 'reason', reason };
}

function mergeObjectMember(
	state: MergeState,
	schema: ParsedJSONSchemaObject,
	index: number
): string | undefined {
	const declaredProperties = Object.entries(
		(schema.properties ?? {}) as Record<string, ParsedJSONSchema>
	);
	const additionalConflict = additionalPropertiesConflict(state, index, declaredProperties.length);

	if (additionalConflict !== undefined) {
		return additionalConflict;
	}

	const propertyConflict = mergeProperties(state, declaredProperties, index);

	if (propertyConflict !== undefined) {
		return propertyConflict;
	}

	mergeRequired(state, schema.required);
	return mergeAdditionalProperties(state, schema.additionalProperties, index);
}

// `additionalProperties` only considers the `properties` declared next to
// it, so merging it with properties from another subschema would accept
// keys the schema rejects.
function additionalPropertiesConflict(
	state: MergeState,
	index: number,
	propertyCount: number
): string | undefined {
	if (state.additionalDeclared && state.additionalOwner !== index && propertyCount > 0) {
		return additionalPropertiesReason;
	}

	return undefined;
}

function mergeProperties(
	state: MergeState,
	declaredProperties: [string, ParsedJSONSchema][],
	index: number
): string | undefined {
	for (const [key, property] of declaredProperties) {
		if (Object.hasOwn(state.properties, key)) {
			return `property ${JSON.stringify(key)} is declared by more than one subschema`;
		}

		state.properties[key] = property;
		state.propertyOwners.set(key, index);
	}

	return undefined;
}

function mergeRequired(state: MergeState, required: ParsedJSONSchemaObject['required']): void {
	for (const key of required ?? []) {
		if (typeof key === 'string') {
			state.required.add(key);
		}
	}
}

function mergeAdditionalProperties(
	state: MergeState,
	additional: ParsedJSONSchemaObject['additionalProperties'],
	index: number
): string | undefined {
	if (additional === undefined || additional === true) {
		return undefined;
	}

	const conflict = additionalValueConflict(state, additional, index);

	if (conflict !== undefined) {
		return conflict;
	}

	state.additionalProperties = additional;
	state.additionalOwner = index;
	state.additionalDeclared = true;
	return undefined;
}

function additionalValueConflict(
	state: MergeState,
	additional: ParsedJSONSchemaObject['additionalProperties'],
	index: number
): string | undefined {
	if (!state.additionalDeclared) {
		return undefined;
	}

	if (state.additionalProperties !== additional) {
		return 'every subschema would have to declare the same "additionalProperties"';
	}

	if ([...state.propertyOwners.values()].some((owner) => owner !== index)) {
		return additionalPropertiesReason;
	}

	return undefined;
}

function mergedObject(state: MergeState): ParsedJSONSchemaObject {
	const merged: Record<string, unknown> = {
		type: 'object',
		properties: state.properties,
		required: [...state.required],
	};

	if (state.additionalDeclared) {
		merged.additionalProperties = state.additionalProperties;
	}

	return merged as unknown as ParsedJSONSchemaObject;
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
