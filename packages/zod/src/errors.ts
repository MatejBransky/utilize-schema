import { Meta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

export class UnsupportedCyclicReferenceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedCyclicReferenceError';
	}
}

/**
 * A `pattern` that the generated `RegExp` constructor cannot compile in Unicode
 * mode. Unicode mode is what the specification requires, but it rejects escapes
 * and quantifiers that other engines tolerate, so the error names the keyword
 * and the offending pattern instead of failing with a bare `SyntaxError`.
 */
export class UnsupportedPatternError extends Error {
	constructor(keyword: string, pattern: string) {
		super(
			`"${keyword}" is not a valid ECMAScript regular expression in unicode mode: ${JSON.stringify(pattern)}.`
		);
		this.name = 'UnsupportedPatternError';
	}
}

/**
 * Describes where a schema sits in the parsed input, e.g.
 * `definitions/CycleB.json#/properties/a` or `#/$defs/Tree`.
 */
function schemaLocation(schema: ParsedJSONSchemaObject): string {
	const meta = schema[Meta];
	const file = meta.filePath === '#' ? '#' : meta.filePath;

	return `${file}#/${meta.path.join('/')}`;
}

/**
 * A cycle made only of unions and aliases has no value type TypeScript can
 * express recursively, so it fails at generation time instead of emitting
 * code that does not type-check.
 */
export function unsupportedUnionCycleError(
	groups: ParsedJSONSchemaObject[][]
): UnsupportedCyclicReferenceError {
	const lines = groups.flat().map((schema) => `  - ${schemaLocation(schema)}`);

	return new UnsupportedCyclicReferenceError(
		[
			'Cannot generate a type-safe Zod schema for a cyclic $ref that only passes through unions or aliases:',
			...lines,
			'',
			'A recursive type needs an object, array, tuple or record in the cycle',
			'so TypeScript can represent it. Add one of those to the cycle.',
		].join('\n')
	);
}
