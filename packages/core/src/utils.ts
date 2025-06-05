/**
 * Determines if a value is a plain object (i.e., created by {} or new Object()).
 * This function is a replacement for lodash.isPlainObject.
 *
 * @param value - The value to check.
 * @returns True if the value is a plain object, false otherwise.
 *
 * @example
 * isPlainObject({}); // true
 * isPlainObject(new Object()); // true
 * isPlainObject([]); // false
 * isPlainObject(null); // false
 * isPlainObject(Object.create(null)); // true
 * isPlainObject(class MyClass {}); // false
 */
export function isPlainObject(value: unknown) {
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
