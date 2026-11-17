import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

export type CustomNameResolver = (
	schema: ParsedJSONSchemaObject,
	usedNames: Set<string>
) => string | void;

/**
 * Rewrites the name of a generated declaration, e.g. to append a `Schema`
 * suffix. The generator passes the name it resolved for the schema, so a mapper
 * only has to describe the difference.
 */
export type NameMapper = (defaultName: string) => string;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Applies a name mapper. A result that is already an identifier is kept as it
 * is, so a mapper can choose its own casing; anything else is turned into one.
 * A result with no usable characters falls back to the resolved name.
 */
export function mapName(defaultName: string, mapper?: NameMapper): string {
	if (!mapper) {
		return defaultName;
	}

	const mapped = mapper(defaultName);

	if (IDENTIFIER.test(mapped)) {
		return mapped;
	}

	return toSafeString(mapped) || defaultName;
}

/** Names under which a standalone schema is exported. */
export interface DeclarationNames {
	/** Variable that holds the generated schema. */
	schema: string;
	/** Type exported for the schema. */
	type: string;
}

export interface MapDeclarationNamesOptions {
	schemaName?: NameMapper;
	typeName?: NameMapper;
	/** Names the generated code already uses, such as the library import. */
	reservedNames: readonly string[];
}

export interface MappedDeclarationNames {
	/** One entry per resolved name, in the same order. */
	names: DeclarationNames[];
	/** Every value name in use, to allocate further values from. */
	valueNames: Set<string>;
	/** Every type name in use, to allocate further types from. */
	typeNames: Set<string>;
}

/**
 * Maps the resolved names of all standalone schemas at once, after every one
 * of them is known. Values and types live in separate TypeScript namespaces, so
 * each gets its own pool: a mapped name only competes with other names of the
 * same kind and never takes the name another schema resolved to. Both pools are
 * filled in the same order, so mappers that agree give a schema and its type
 * the same name.
 */
export function mapDeclarationNames(
	resolvedNames: readonly string[],
	{ schemaName, typeName, reservedNames }: MapDeclarationNamesOptions
): MappedDeclarationNames {
	const valueNames = new Set(reservedNames);
	const typeNames = new Set(reservedNames);
	const names = resolvedNames.map((resolvedName) => ({
		schema: allocateName(mapName(resolvedName, schemaName), valueNames),
		type: allocateName(mapName(resolvedName, typeName), typeNames),
	}));

	return { names, valueNames, typeNames };
}

/** Reserves `base`, or `base` with the first free numeric suffix. */
export function allocateName(base: string, usedNames: Set<string>): string {
	let name = base;
	let counter = 1;

	while (usedNames.has(name)) {
		name = `${base}${counter++}`;
	}

	usedNames.add(name);
	return name;
}

interface ResolveNameOptions {
	schema: ParsedJSONSchemaObject;
	usedNames?: Set<string>;
	customResolver?: CustomNameResolver;
}

export function resolveName({
	schema,
	usedNames = new Set(),
	customResolver,
}: ResolveNameOptions): string {
	// 0. If user provided a custom resolver, use it first
	if (customResolver) {
		const customName = customResolver(schema, usedNames);
		if (customName) {
			return customName;
		}
	}

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
		const idx = meta.path.findIndex((p) => p === '$defs' || p === 'definitions');
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
	let name: string = toSafeString(justName(from) ?? from);
	if (!name) name = 'NoName';

	// increment counter until we find a free name
	if (usedNames.has(name)) {
		let counter = 1;

		while (usedNames.has(`${name}${counter}`)) {
			counter++;
		}

		name = `${name}${counter}`;
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
