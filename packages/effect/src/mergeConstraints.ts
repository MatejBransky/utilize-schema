import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

/** The combined constraints of the members that allOf merges into one schema. */
export interface TypedConstraints {
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	multipleOf?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
}

export function mergeTypedMember(
	constraints: TypedConstraints,
	member: ParsedJSONSchemaObject
): boolean {
	return (
		mergeNumericConstraints(constraints, member) &&
		mergeStringConstraints(constraints, member) &&
		mergeArrayConstraints(constraints, member)
	);
}

function mergeNumericConstraints(
	constraints: TypedConstraints,
	member: ParsedJSONSchemaObject
): boolean {
	return (
		mergeMinimum(constraints, member.minimum) &&
		mergeExclusiveMinimum(constraints, member.exclusiveMinimum) &&
		mergeMaximum(constraints, member.maximum) &&
		mergeExclusiveMaximum(constraints, member.exclusiveMaximum) &&
		mergeMultipleOf(constraints, member.multipleOf)
	);
}

function mergeStringConstraints(
	constraints: TypedConstraints,
	member: ParsedJSONSchemaObject
): boolean {
	return (
		mergeMinLength(constraints, member.minLength) &&
		mergeMaxLength(constraints, member.maxLength) &&
		mergePattern(constraints, member.pattern)
	);
}

function mergeArrayConstraints(
	constraints: TypedConstraints,
	member: ParsedJSONSchemaObject
): boolean {
	return (
		mergeMinItems(constraints, member.minItems) &&
		mergeMaxItems(constraints, member.maxItems) &&
		mergeUniqueItems(constraints, member.uniqueItems)
	);
}

function mergeMinimum(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.minimum =
		constraints.minimum === undefined ? value : Math.max(constraints.minimum, value);
	return true;
}

function mergeMaximum(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.maximum =
		constraints.maximum === undefined ? value : Math.min(constraints.maximum, value);
	return true;
}

function mergeExclusiveMinimum(constraints: TypedConstraints, value: unknown): boolean {
	if (value === undefined) {
		return true;
	}

	if (typeof value !== 'number') {
		return false;
	}

	constraints.exclusiveMinimum =
		constraints.exclusiveMinimum === undefined
			? value
			: Math.max(constraints.exclusiveMinimum, value);
	return true;
}

function mergeExclusiveMaximum(constraints: TypedConstraints, value: unknown): boolean {
	if (value === undefined) {
		return true;
	}

	if (typeof value !== 'number') {
		return false;
	}

	constraints.exclusiveMaximum =
		constraints.exclusiveMaximum === undefined
			? value
			: Math.min(constraints.exclusiveMaximum, value);
	return true;
}

function mergeMultipleOf(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	if (constraints.multipleOf !== undefined && constraints.multipleOf !== value) {
		return false;
	}

	constraints.multipleOf = value;
	return true;
}

function mergeMinLength(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.minLength =
		constraints.minLength === undefined ? value : Math.max(constraints.minLength, value);
	return true;
}

function mergeMaxLength(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.maxLength =
		constraints.maxLength === undefined ? value : Math.min(constraints.maxLength, value);
	return true;
}

function mergePattern(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'string') {
		return true;
	}

	if (constraints.pattern !== undefined && constraints.pattern !== value) {
		return false;
	}

	constraints.pattern = value;
	return true;
}

function mergeMinItems(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.minItems =
		constraints.minItems === undefined ? value : Math.max(constraints.minItems, value);
	return true;
}

function mergeMaxItems(constraints: TypedConstraints, value: unknown): boolean {
	if (typeof value !== 'number') {
		return true;
	}

	constraints.maxItems =
		constraints.maxItems === undefined ? value : Math.min(constraints.maxItems, value);
	return true;
}

function mergeUniqueItems(constraints: TypedConstraints, value: unknown): boolean {
	if (value === true) {
		constraints.uniqueItems = true;
	}

	return true;
}
