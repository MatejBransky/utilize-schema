import { type ParsedJSONSchemaObject, Meta } from '@utilize/json-schema';

export class UnresolvedReferenceError extends Error {
	constructor(ref: string) {
		super(`Could not resolve $ref "${ref}".`);
		this.name = 'UnresolvedReferenceError';
	}
}

export class UnsupportedCircularTypeError extends Error {
	constructor(groups: ParsedJSONSchemaObject[][]) {
		super(
			[
				'Cannot generate a TypeScript type for a $ref cycle that only passes through aliases, unions or intersections:',
				...groups.flat().map((schema) => `  - ${schemaLocation(schema)}`),
				'',
				'A recursive type needs an object, array or tuple in the cycle so TypeScript',
				'can defer the reference. Add one of those to the cycle.',
			].join('\n')
		);
		this.name = 'UnsupportedCircularTypeError';
	}
}

/**
 * Describes where a schema sits in the parsed input, e.g.
 * `definitions/CycleB.json#/properties/a` or `#/$defs/Tree`.
 */
export function schemaLocation(schema: ParsedJSONSchemaObject): string {
	const meta = schema[Meta];
	const pointer = meta.path.length > 0 ? `#/${meta.path.join('/')}` : '#';

	return meta.filePath === '#' ? pointer : `${meta.filePath}${pointer}`;
}
