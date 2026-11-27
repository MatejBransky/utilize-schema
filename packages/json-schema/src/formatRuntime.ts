import { formats } from './formats';

import { allocateName } from './resolveName';

/**
 * Target-neutral format metadata the generators share: patterns that need no
 * runtime code, names for the validators a file imports, and the set of
 * formats whose validators live in `@utilize/json-schema/formats`.
 */

/** Module generated code imports the structural format validators from. */
export const formatRuntimeModule = '@utilize/json-schema/formats';

const exactEnd = String.raw`(?![\s\S])`;

const patterns = new Map<string, string>([
	['json-pointer', String.raw`^(?:\/(?:[^~]|~[01])*)?${exactEnd}`],
	['relative-json-pointer', String.raw`^(?:0|[1-9][0-9]*)(?:#|\/(?:[^~]|~[01])*)?${exactEnd}`],
	[
		'uuid',
		String.raw`^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}${exactEnd}`,
	],
]);

export function formatPattern(format: string): string | undefined {
	return patterns.get(format);
}

/**
 * Whether the format needs a validator from `@utilize/json-schema/formats`.
 * Formats it returns `false` for are either a single pattern or unknown.
 */
export function hasFormatValidator(format: string): boolean {
	return Object.hasOwn(formats, format);
}

/** Allocates one reusable import name per format within a generated module. */
export function formatNameFor(
	format: string,
	formatNames: Map<string, string>,
	usedNames: Set<string>
): string {
	const existing = formatNames.get(format);

	if (existing !== undefined) {
		return existing;
	}

	const name = allocateName(formatConstantBase(format), usedNames);

	formatNames.set(format, name);
	return name;
}

/** `date-time` becomes `formatDateTime`, matching the runtime export. */
export function formatConstantBase(format: string): string {
	const pascal = format.replaceAll(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) =>
		next === undefined ? '' : next.toUpperCase()
	);

	return `format${pascal.charAt(0).toUpperCase()}${pascal.slice(1)}`;
}
