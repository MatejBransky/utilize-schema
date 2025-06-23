import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

interface ResolveNameOptions {
	schema: ParsedJSONSchemaObject;
	usedNames?: Set<string>;
}

export function resolveName({
	schema,
	usedNames = new Set(),
}: ResolveNameOptions): string {
	// 1. Prefer $id or title if present
	if (schema.$id) {
		const id = schema.$id.split(/[/#]/).filter(Boolean).pop()!;
		return generateName(id, usedNames);
	}
	if (schema.title) {
		return generateName(schema.title, usedNames);
	}

	// 2. If schema is in $defs/definitions, use the key name from path
	const meta = schema[Meta];
	if (meta?.path) {
		// Try to find $defs or definitions in the path and use the next segment as name
		const idx = meta.path.findIndex(
			(p) => p === '$defs' || p === 'definitions'
		);
		if (idx >= 0 && typeof meta.path[idx + 1] === 'string') {
			return generateName(meta.path[idx + 1] as string, usedNames);
		}
	}

	// 3. For external schemas, use fileName from Meta
	if (meta.parent === null) {
		return generateName(meta.fileName, usedNames);
	}

	// 4. Fallback
	const base = 'Unknown';
	return generateName(base, usedNames);
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
