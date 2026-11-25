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

	const Ctor = Object.hasOwn(proto, 'constructor')
		? (proto as { constructor?: unknown }).constructor
		: undefined;
	return (
		typeof Ctor === 'function' &&
		Ctor instanceof Ctor &&
		Function.prototype.call(Ctor) === Function.prototype.call(value)
	);
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
