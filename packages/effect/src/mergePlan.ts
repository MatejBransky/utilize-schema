import { schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { ANNOTATION_KEYWORDS } from './keywords';
import type { TypedConstraints } from './mergeConstraints';
import { mergeTypedMember } from './mergeConstraints';

/** Keywords a typed subschema may use and still be merged. */
const MERGEABLE_TYPES = ['number', 'integer', 'string', 'array'] as const;
type MergeableType = (typeof MERGEABLE_TYPES)[number];

const MERGEABLE_KEYWORDS: Record<'number' | 'string' | 'array', ReadonlySet<string>> = {
	number: new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']),
	string: new Set(['minLength', 'maxLength', 'pattern']),
	array: new Set(['minItems', 'maxItems', 'uniqueItems']),
};

const MERGE_TYPE_RESULTS = new Map<string, MergeableType>([
	['number:number', 'number'],
	['number:integer', 'integer'],
	['integer:number', 'integer'],
	['integer:integer', 'integer'],
	['string:string', 'string'],
	['array:array', 'array'],
]);

const TYPED_CONSTRAINT_KEYWORDS = [
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minLength',
	'maxLength',
	'pattern',
	'minItems',
	'maxItems',
	'uniqueItems',
] as const;

interface MergeTypePlan {
	type: MergeableType;
	declaredType: boolean;
}

/**
 * Merges subschemas that constrain one JSON type. Bounds are combined into the
 * strictest one; a keyword that cannot be combined (`pattern`, a different
 * `multipleOf`, array items) keeps the intersection a filter.
 */
export function mergeTypedSchemas(
	members: ParsedJSONSchemaObject[]
): ParsedJSONSchemaObject | undefined {
	const plan = planTypedMerge(members);

	if (plan === undefined) {
		return undefined;
	}

	const constraints: TypedConstraints = {};

	for (const member of members) {
		if (!mergeTypedMember(constraints, member)) {
			return undefined;
		}
	}

	return renderTypedSchema(plan, constraints);
}

interface MergeTypeState {
	type?: MergeableType;
	declaredType: boolean;
}

function planTypedMerge(members: ParsedJSONSchemaObject[]): MergeTypePlan | undefined {
	const state: MergeTypeState = { declaredType: false };

	for (const member of members) {
		if (!mergeMemberType(state, member)) {
			return undefined;
		}
	}

	return state.type === undefined
		? undefined
		: { type: state.type, declaredType: state.declaredType };
}

function mergeMemberType(state: MergeTypeState, member: ParsedJSONSchemaObject): boolean {
	if (member.$ref !== undefined) {
		return false;
	}

	const memberType = mergeableType(member);

	if (memberType === undefined) {
		return false;
	}

	if (isDeclaredMergeType(member.type)) {
		state.declaredType = true;
	}

	state.type = combineMergeTypes(state.type, memberType);
	return state.type !== undefined && hasOnlyMergeableKeywords(member, memberType);
}

function isDeclaredMergeType(type: ParsedJSONSchemaObject['type']): type is MergeableType {
	return MERGEABLE_TYPES.some((candidate) => candidate === type);
}

function combineMergeTypes(
	previous: MergeableType | undefined,
	next: MergeableType
): MergeableType | undefined {
	return previous === undefined ? next : MERGE_TYPE_RESULTS.get(`${previous}:${next}`);
}

function hasOnlyMergeableKeywords(
	member: ParsedJSONSchemaObject,
	memberType: MergeableType
): boolean {
	const allowed = MERGEABLE_KEYWORDS[memberType === 'integer' ? 'number' : memberType];

	for (const [keyword, value] of Object.entries(member)) {
		if (!isMergeableKeyword(keyword, value, allowed)) {
			return false;
		}
	}

	return true;
}

function isMergeableKeyword(
	keyword: string,
	value: unknown,
	allowed: ReadonlySet<string>
): boolean {
	return (
		value === undefined ||
		ANNOTATION_KEYWORDS.has(keyword) ||
		keyword === 'type' ||
		allowed.has(keyword)
	);
}

function renderTypedSchema(
	plan: MergeTypePlan,
	constraints: TypedConstraints
): ParsedJSONSchemaObject {
	// Keywords like `minimum` or `minItems` only constrain their own JSON type, so
	// the type stays inferred unless a member declared it.
	const merged: Record<string, unknown> = plan.declaredType ? { type: plan.type } : {};

	for (const keyword of TYPED_CONSTRAINT_KEYWORDS) {
		const value = constraints[keyword];

		if (value !== undefined) {
			merged[keyword] = value;
		}
	}

	// oxlint-disable-next-line quality/no-chained-type-assertions -- synthetic node; it has no source Meta to copy
	return merged as unknown as ParsedJSONSchemaObject;
}

/** The type a subschema constrains, from `type` or its keyword family. */
function mergeableType(schema: ParsedJSONSchemaObject): MergeableType | undefined {
	const declared = MERGEABLE_TYPES.find((type) => type === schema.type);

	if (declared !== undefined) {
		return declared;
	}

	if (schema.type !== undefined) {
		return undefined;
	}

	const candidates = mergeTypeCandidates(schema);

	return candidates.length === 1 ? candidates[0] : undefined;
}

function mergeTypeCandidates(schema: ParsedJSONSchemaObject): MergeableType[] {
	const record = schemaRecord(schema);
	const has = (keywords: string[]) => keywords.some((keyword) => record[keyword] !== undefined);
	const candidates: MergeableType[] = [];

	if (has(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'])) {
		candidates.push('number');
	}

	if (has(['minLength', 'maxLength', 'pattern'])) {
		candidates.push('string');
	}

	if (has(['minItems', 'maxItems', 'uniqueItems'])) {
		candidates.push('array');
	}

	return candidates;
}
