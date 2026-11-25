import { isPlainObject } from '@utilize/json-schema';
import type { JSONSchemaTypeName } from '@utilize/json-schema';

/** True when the JSON value is an instance of the JSON Schema `type`. */
export function valueHasType(value: unknown, type: JSONSchemaTypeName): boolean {
	switch (type) {
		case 'null':
			return value === null;
		case 'array':
			return Array.isArray(value);
		case 'object':
			return isPlainObject(value);
		case 'integer':
			return Number.isInteger(value);
		default:
			return typeof value === type;
	}
}

/** Deep equality of two JSON values, ignoring the order of object keys. */
export function jsonEquals(left: unknown, right: unknown): boolean {
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length && left.every((value, index) => jsonEquals(value, right[index]))
		);
	}

	if (isPlainObject(left) && isPlainObject(right)) {
		const keys = Object.keys(left);

		return (
			keys.length === Object.keys(right).length &&
			keys.every((key) => Object.hasOwn(right, key) && jsonEquals(left[key], right[key]))
		);
	}

	return left === right;
}
