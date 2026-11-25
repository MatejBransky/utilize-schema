import {
	generateName,
	justName,
	Meta,
	resolveExplicitName,
	toSafeString,
	type ResolveNameOptions,
} from '@utilize/json-schema';

// The naming helpers live in @utilize/json-schema, shared with the other
// generators. They stay exported from @utilize/zod, as before.
export {
	allocateName,
	generateName,
	justName,
	mapDeclarationNames,
	mapName,
	resolveName,
	stripExtension,
	toSafeString,
	type CustomNameResolver,
	type DeclarationNames,
	type MapDeclarationNamesOptions,
	type MappedDeclarationNames,
	type NameMapper,
} from '@utilize/json-schema';

/**
 * Names a declaration hoisted out of the inline subschemas it replaces: by
 * `$id` or `title`, else after the place its first copy appears, e.g.
 * `TagsItem` for the items of a `tags` property.
 */
export function resolveHoistedName({
	schema,
	usedNames = new Set(),
	customResolver,
}: ResolveNameOptions): string {
	const explicitName = resolveExplicitName({ schema, usedNames, customResolver });

	if (explicitName !== undefined) {
		return explicitName;
	}

	const meta = schema[Meta];

	return generateName(nameFromPath(meta.path, justName(meta.fileName) ?? meta.fileName), usedNames);
}

/** Keywords followed by a key that names the subschema below them. */
const KEYED_KEYWORDS = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependencies',
]);

/** Suffixes for the subschemas of a keyword, e.g. `Item` for `items`. */
const KEYWORD_SUFFIXES = new Map([
	['items', 'Item'],
	['additionalItems', 'Item'],
	['contains', 'Item'],
	['additionalProperties', 'Value'],
	['propertyNames', 'Key'],
	['allOf', 'Part'],
	['anyOf', 'Option'],
	['oneOf', 'Option'],
	['not', 'Not'],
	['if', 'If'],
	['then', 'Then'],
	['else', 'Else'],
]);

/**
 * Builds a name from the last key in a JSON pointer path and the keywords
 * after it, e.g. `["properties", "tags", "items"]` becomes `TagsItem`. A path
 * without a key starts from the file name.
 */
function nameFromPath(path: readonly (string | number)[], fileName: string): string {
	let base = fileName;
	let suffix = '';

	for (let index = 0; index < path.length; index++) {
		const segment = String(path[index]);

		if (KEYED_KEYWORDS.has(segment) && index + 1 < path.length) {
			base = String(path[++index]);
			suffix = '';
		} else {
			suffix += KEYWORD_SUFFIXES.get(segment) ?? '';
		}
	}

	return toSafeString(base) + suffix;
}
