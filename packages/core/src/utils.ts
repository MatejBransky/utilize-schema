import {
	Parent,
	type JSONSchema,
	type LinkedJSONSchema,
} from './types/JSONSchema';

/**
 * Determines if a value is a plain object (i.e., created by {} or new Object()).
 * This function is a replacement for lodash.isPlainObject.
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
 * Checks if a given string is a safe JavaScript identifier.
 *
 * A safe identifier starts with a letter (a-z, case-insensitive), underscore (_), or dollar sign ($),
 * followed by any number of letters, digits, underscores, or dollar signs.
 *
 * Examples of safe identifiers:
 *   isSafeIdentifier("myVar")      // true
 *   isSafeIdentifier("_private")   // true
 *   isSafeIdentifier("$dollar")    // true
 *   isSafeIdentifier("a1b2c3")     // true
 *
 * Examples of unsafe identifiers:
 *   isSafeIdentifier("1stVar")     // false (starts with a digit)
 *   isSafeIdentifier("my var")     // false (contains a space)
 *   isSafeIdentifier("var!")       // false (contains '!')
 *   isSafeIdentifier("")           // false (empty string)
 */
export function isSafeIdentifier(string: string) {
	return /^[a-z_$][\w$]*$/i.test(string);
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

/**
 * Removes the schema's `$id`, `name`, and `description` properties
 * if they exist.
 * Useful when parsing intersections.
 *
 * Mutates `schema`.
 */
export function maybeStripNameHints<S extends JSONSchema>(schema: S): S {
	if ('$id' in schema) delete schema.$id;

	if ('description' in schema) delete schema.description;

	if ('name' in schema) delete schema.name;

	return schema;
}

/**
 * Returns the key of the first element predicate returns truthy
 */
export function findKey<T>(
	obj: Record<string, T>,
	predicate: (value: T, key: string) => boolean
): string | undefined {
	for (const key of Object.keys(obj)) {
		if (predicate(obj[key]!, key)) {
			return key;
		}
	}
	return undefined;
}

export function assert(
	condition: unknown,
	message?: string
): asserts condition {
	if (!condition) {
		throw new Error(message ?? 'Assertion failed');
	}
}

export function generateName(from: string, usedNames: Set<string>) {
	let name: string = toSafeString(from);
	if (!name) name = 'NoName';

	// increment counter until we find a free name
	if (usedNames.has(name)) {
		let counter = 1;
		let nameWithCounter = `${name}${counter}`;
		while (usedNames.has(nameWithCounter)) {
			nameWithCounter = `${name}${counter}`;
			counter++;
		}
		name = nameWithCounter;
	}

	usedNames.add(name);
	return name;
}
