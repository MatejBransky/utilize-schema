import { Parent, type LinkedJSONSchema } from './types/JSONSchema';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSchemaLike(schema: any): schema is LinkedJSONSchema {
	if (!isPlainObject(schema)) {
		return false;
	}

	// top-level schema
	const parent = schema[Parent];
	if (parent === null) {
		return true;
	}

	const JSON_SCHEMA_KEYWORDS = [
		'$defs',
		'allOf',
		'anyOf',
		'definitions',
		'dependencies',
		'enum',
		'not',
		'oneOf',
		'patternProperties',
		'properties',
		'required',
	];
	if (JSON_SCHEMA_KEYWORDS.some((_) => parent[_] === schema)) {
		return false;
	}

	return true;
}

/**
 * Convert a string that might contain spaces or special characters to one that
 * can safely be used as a TypeScript interface or enum name.
 */
export function toSafeString(string: string) {
	// identifiers in javaScript/ts:
	// First character: a-zA-Z | _ | $
	// Rest: a-zA-Z | _ | $ | 0-9

	return upperFirst(
		// remove accents, umlauts, ... by their basic latin letters
		deburr(string)
			// remove leading characters that are not valid as the first character in a TypeScript identifier (i.e., not a letter, $ or _)
			.replace(/^[^a-zA-Z_$]+/, '')
			// replace characters that are not valid in TypeScript identifiers (except for digits after the first character) with whitespace
			.replace(/[^a-zA-Z0-9_$]+/g, ' ')
			// uppercase leading underscores followed by lowercase
			.replace(/^_[a-z]/g, (match) => match.toUpperCase())
			// remove non-leading underscores followed by lowercase (convert snake_case)
			.replace(/_[a-z]/g, (match) => match.substring(1).toUpperCase())
			// uppercase letters after digits, dollars
			.replace(/([\d$]+[a-zA-Z])/g, (match) => match.toUpperCase())
			// uppercase first letter after whitespace
			.replace(/\s+([a-zA-Z])/g, (match) => match.toUpperCase())
			.trim()
			// remove remaining whitespace
			.replace(/\s/g, '')
	) as string;
}

/**
 * Capitalizes the first character of a string.
 */
const upperFirst = (input: string) => {
	return input ? input.charAt(0).toUpperCase() + input.slice(1) : '';
};

/**
 * Removes diacritical marks (accents, umlauts, etc.) from a string,
 * converting it to its basic Latin letters.
 *
 * @param str - The string to deburr.
 * @returns The deburred string.
 *
 * @example
 * deburr('déjà vu'); // 'deja vu'
 * deburr('Český'); // 'Cesky'
 */
function deburr(str: string): string {
	return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Eg. `foo/bar/baz.json` => `baz`
 */
export function justName(filename = ''): string {
	const parts = filename.split(/[\\/]/);
	const lastPart = parts.at(-1);
	if (!lastPart) {
		return '';
	}
	return stripExtension(lastPart);
}

/**
 * Avoid appending "js" to top-level unnamed schemas
 */
function stripExtension(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot > 0) {
		return filename.slice(0, lastDot);
	}
	return filename;
}
