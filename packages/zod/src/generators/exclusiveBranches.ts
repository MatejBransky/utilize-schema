import { dialectOf, isKeywordApplicable, Meta } from '@utilize/json-schema';
import type {
	Dialect,
	JSONSchemaTypeName,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { jsonEquals, valueHasType } from './jsonValues';

/**
 * What a branch can accept at most, read from its `const`, `enum`, `type` and
 * the `const` of its required properties. Any other keyword only narrows it.
 */
interface BranchShape {
	/** The only values the branch accepts. */
	values?: unknown[];
	/** The only types the branch accepts. */
	types?: JSONSchemaTypeName[];
	/** For a branch that accepts objects only: required properties and their only values. */
	tags: Map<string, unknown[]>;
}

export interface ExclusiveBranchesOptions {
	/** Dialect of a node without `Meta`. */
	dialect: Dialect;
	/** True for a node whose generated code is not known, e.g. caller-provided code. */
	isOpaque(schema: ParsedJSONSchemaObject): boolean;
}

/**
 * True when no JSON value can match two of the branches. A `oneOf` over such
 * branches accepts the same values as an `anyOf`, so it needs no check that
 * exactly one branch matched. Returns false whenever that cannot be proven.
 */
export function areMutuallyExclusive(
	branches: ParsedJSONSchema[],
	options: ExclusiveBranchesOptions
): boolean {
	const shapes: BranchShape[] = [];

	for (const branch of branches) {
		const shape = shapeOf(branch, options, new Set());

		if (!shape) {
			return false;
		}

		shapes.push(shape);
	}

	return shapes.every((shape, index) =>
		shapes.slice(index + 1).every((other) => areDisjoint(shape, other))
	);
}

function shapeOf(
	schema: ParsedJSONSchema | undefined,
	options: ExclusiveBranchesOptions,
	visiting: Set<ParsedJSONSchemaObject>
): BranchShape | undefined {
	if (schema === false) {
		return { values: [], tags: new Map() };
	}

	// `default` lets Zod accept a missing value, which could then match
	// several branches.
	if (!canDescribeShape(schema, options, visiting)) {
		return undefined;
	}

	visiting.add(schema);

	if ('$ref' in schema) {
		return shapeOf(schema[Meta]?.reference, options, visiting);
	}

	const dialect = dialectOf(schema, options.dialect);
	const types = typesOf(schema);

	return {
		values: valuesOf(schema, dialect),
		types,
		tags: types?.every((type) => type === 'object')
			? requiredTags(schema, options, visiting)
			: new Map<string, unknown[]>(),
	};
}

function canDescribeShape(
	schema: ParsedJSONSchema | undefined,
	options: ExclusiveBranchesOptions,
	visiting: Set<ParsedJSONSchemaObject>
): schema is ParsedJSONSchemaObject {
	return (
		typeof schema === 'object' &&
		schema !== null &&
		!visiting.has(schema) &&
		schema.default === undefined &&
		!options.isOpaque(schema)
	);
}

function valuesOf(schema: ParsedJSONSchemaObject, dialect: Dialect): unknown[] | undefined {
	return schema.const !== undefined && isKeywordApplicable(dialect, 'const')
		? [schema.const]
		: schema.enum;
}

function typesOf(schema: ParsedJSONSchemaObject): JSONSchemaTypeName[] | undefined {
	if (schema.type === undefined) {
		return undefined;
	}

	const types = [schema.type].flat();

	return types.every((type) => typeof type === 'string') ? types : undefined;
}

function requiredTags(
	schema: ParsedJSONSchemaObject,
	options: ExclusiveBranchesOptions,
	visiting: Set<ParsedJSONSchemaObject>
): Map<string, unknown[]> {
	const tags = new Map<string, unknown[]>();

	for (const key of schema.required ?? []) {
		const property = schema.properties?.[key];
		const values = property && shapeOf(property, options, new Set(visiting))?.values;

		if (values) {
			tags.set(key, values);
		}
	}

	return tags;
}

function areDisjoint(left: BranchShape, right: BranchShape): boolean {
	return (
		haveNoCommonValue(left.values, right.values) ||
		haveNoValueOfType(left.values, right.types) ||
		haveNoValueOfType(right.values, left.types) ||
		haveNoCommonType(left.types, right.types) ||
		[...left.tags].some(([key, values]) => haveNoCommonValue(values, right.tags.get(key)))
	);
}

function haveNoCommonValue(left?: unknown[], right?: unknown[]): boolean {
	if (!left || !right) {
		return false;
	}

	return !left.some((value) => right.some((other) => jsonEquals(value, other)));
}

function haveNoValueOfType(values?: unknown[], types?: JSONSchemaTypeName[]): boolean {
	if (!values || !types) {
		return false;
	}

	return !values.some((value) => types.some((type) => valueHasType(value, type)));
}

function haveNoCommonType(left?: JSONSchemaTypeName[], right?: JSONSchemaTypeName[]): boolean {
	if (!left || !right) {
		return false;
	}

	return !left.some((type) => right.some((other) => typesOverlap(type, other)));
}

/** `integer` is a subset of `number`, so the two overlap. */
function normalizeNumberType(type: JSONSchemaTypeName): JSONSchemaTypeName {
	return type === 'integer' ? 'number' : type;
}

function typesOverlap(left: JSONSchemaTypeName, right: JSONSchemaTypeName): boolean {
	return normalizeNumberType(left) === normalizeNumberType(right);
}
