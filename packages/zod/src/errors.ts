import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

export class UnsupportedCyclicReferenceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedCyclicReferenceError';
	}
}

/**
 * Describes where a schema sits in the parsed input, e.g.
 * `definitions/CycleB.json#/properties/a` or `#/$defs/Tree`.
 */
export function schemaLocation(schema: ParsedJSONSchemaObject): string {
	const meta = schema[Meta];
	const file = meta.filePath === '#' ? '#' : meta.filePath;

	return `${file}#/${meta.path.join('/')}`;
}

/**
 * Builds the error thrown when a recursive reference cannot be deferred with a
 * getter on an object property.
 */
export function unsupportedCycleError(
	refs: ParsedJSONSchemaObject[]
): UnsupportedCyclicReferenceError {
	const lines = refs.map((ref) => `  - ${schemaLocation(ref)} ($ref: ${JSON.stringify(ref.$ref)})`);

	return new UnsupportedCyclicReferenceError(
		[
			'Cannot generate a type-safe Zod schema for this cyclic $ref:',
			...lines,
			'',
			'A recursive reference can only be deferred with a getter on an object property.',
			'Put the reference under an object\'s "properties", or restructure the schemas',
			'so that the cycle passes through an object property.',
		].join('\n')
	);
}
