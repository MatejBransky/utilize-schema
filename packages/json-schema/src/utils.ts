/**
 * Determines if a value is a plain object (i.e., created by {} or new Object()).
 * This function is a replacement for lodash.isPlainObject.
 */
export function isPlainObject(
	value: unknown
): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false;

	if (Object.prototype.toString.call(value) !== '[object Object]') return false;

	const proto = Object.getPrototypeOf(value);
	if (proto === null) return true;

	const Ctor =
		Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
		proto.constructor;
	return (
		typeof Ctor === 'function' &&
		Ctor instanceof Ctor &&
		Function.prototype.call(Ctor) === Function.prototype.call(value)
	);
}

export function assert(
	condition: unknown,
	message?: string
): asserts condition {
	if (!condition) {
		throw new Error(message ?? 'Assertion failed');
	}
}

/**
 * Eg. `foo/bar/baz.json` => `baz`
 */
export function justName(filename = ''): string | undefined {
	const parts = filename.split(/[\\/]/);
	const lastPart = parts.at(-1);
	if (!lastPart) {
		return;
	}
	return stripExtension(lastPart);
}

/**
 * Avoid appending "js" to top-level unnamed schemas
 */
export function stripExtension(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot > 0) {
		return filename.slice(0, lastDot);
	}
	return filename;
}
