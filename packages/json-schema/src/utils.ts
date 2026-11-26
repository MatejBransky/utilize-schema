/**
 * Determines if a value is a plain object (i.e., created by {} or new Object()).
 * This function is a replacement for lodash.isPlainObject.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (Object.prototype.toString.call(value) !== '[object Object]') {
		return false;
	}

	const proto = Reflect.getPrototypeOf(value);
	if (proto === null) {
		return true;
	}

	return Reflect.getPrototypeOf(proto) === null;
}

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? 'Assertion failed');
	}
}

/**
 * Returns `value`, or throws when it is `null` or `undefined`. Use it where the
 * domain guarantees a value and the old code used a non-null assertion.
 */
export function expectDefined<T>(
	value: T | null | undefined,
	message = 'Expected a defined value'
): T {
	if (value === null || value === undefined) {
		throw new Error(message);
	}

	return value;
}

/**
 * Reads the keywords of a linked schema node without copying it. The parser and
 * linker already validated the document, so the node's own keys are fields.
 */
// oxlint-disable-next-line quality/no-object-parameters -- linked nodes are read by dynamic keyword and have no index signature
export function schemaRecord(schema: object): Record<string, unknown> {
	return schema as Record<string, unknown>;
}
