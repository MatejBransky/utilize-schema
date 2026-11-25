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

	const proto = Object.getPrototypeOf(value);
	if (proto === null) {
		return true;
	}

	// oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Object.getPrototypeOf returns `any` by declaration
	const Ctor: unknown = Object.hasOwn(proto, 'constructor') && proto.constructor;
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
