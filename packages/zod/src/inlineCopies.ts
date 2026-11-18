import { isPlainObject, Meta, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { childSchemasOf } from './collectStandaloneSchemas';

/** Inline subschemas mapped to the standalone schema they are identical to. */
export type InlineCopies = ReadonlyMap<ParsedJSONSchemaObject, ParsedJSONSchemaObject>;

/** Keywords whose subschemas make a schema worth replacing with a reference. */
const compositeKeywords = [
	'properties',
	'patternProperties',
	'additionalProperties',
	'items',
	'prefixItems',
	'additionalItems',
	'allOf',
	'anyOf',
	'oneOf',
	'not',
	'if',
] as const;

/**
 * Finds inline subschemas that are identical to a standalone schema, e.g. a
 * `oneOf` that schemars inlined next to the definition it came from. The
 * generator refers to the standalone schema instead of generating the copy
 * again. Only schemas with subschemas count: a lone `{ "type": "string" }` is
 * shorter than a reference.
 *
 * Two schemas are identical when they have the same keywords and values, the
 * same dialect, and every `$ref` resolves to the same schema.
 */
export function findInlineCopies(
	standaloneSchemas: ParsedJSONSchemaObject[],
	isOpaque: (schema: ParsedJSONSchemaObject) => boolean
): InlineCopies {
	const keys = new StructuralKeys();
	const standalone = new Set(standaloneSchemas);
	const declarations = new Map<string, ParsedJSONSchemaObject>();
	const copies = new Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>();

	for (const schema of standaloneSchemas) {
		const key = keys.of(schema);

		if (isComposite(schema) && !isOpaque(schema) && !declarations.has(key)) {
			declarations.set(key, schema);
		}
	}

	function visit(schema: ParsedJSONSchemaObject) {
		for (const child of childSchemasOf(schema)) {
			if (typeof child !== 'object' || child === null || standalone.has(child)) {
				continue;
			}

			const declaration = isComposite(child) ? declarations.get(keys.of(child)) : undefined;

			if (declaration && !isOpaque(child)) {
				copies.set(child, declaration);
			} else {
				visit(child);
			}
		}
	}

	for (const schema of standaloneSchemas) {
		visit(schema);
	}

	return copies;
}

function isComposite(schema: ParsedJSONSchemaObject): boolean {
	return compositeKeywords.some((keyword) => schema[keyword] !== undefined);
}

/** Serializes schemas so that identical schemas, and only those, share a key. */
class StructuralKeys {
	private readonly keys = new Map<object, string>();
	private readonly identities = new Map<unknown, number>();

	of(value: unknown): string {
		if (typeof value !== 'object' || value === null) {
			return JSON.stringify(value) ?? 'undefined';
		}

		let key = this.keys.get(value);

		if (key === undefined) {
			key = Array.isArray(value) ? this.ofArray(value) : this.ofObject(value);
			this.keys.set(value, key);
		}

		return key;
	}

	private ofArray(values: unknown[]): string {
		return `[${values.map((value) => this.of(value)).join(',')}]`;
	}

	private ofObject(value: object): string {
		if (!isPlainObject(value)) {
			return `#${this.identityOf(value)}`;
		}

		const meta = (value as Partial<ParsedJSONSchemaObject>)[Meta];
		const keywords = Object.keys(value);
		// eslint-disable-next-line unicorn/no-array-sort -- Object.keys returns a fresh array
		keywords.sort();
		const entries = keywords.map(
			(keyword) => `${JSON.stringify(keyword)}:${this.ofEntry(value, keyword, meta)}`
		);

		return `{${meta ? `@${meta.dialect}|` : ''}${entries.join(',')}}`;
	}

	private ofEntry(
		value: Record<string, unknown>,
		keyword: string,
		meta: ParsedJSONSchemaObject[typeof Meta] | undefined
	): string {
		if (!meta) {
			return this.of(value[keyword]);
		}

		// A `$ref` string depends on the file it is written in; its target does not.
		if (keyword === '$ref' && typeof value.$ref === 'string') {
			return meta.reference === undefined
				? `unresolved:${meta.filePath}:${value.$ref}`
				: `ref#${this.identityOf(meta.reference)}`;
		}

		// Definitions are declared on their own, so only the same ones match.
		if (keyword === '$defs' || keyword === 'definitions') {
			return `#${this.identityOf(value[keyword])}`;
		}

		return this.of(value[keyword]);
	}

	private identityOf(value: unknown): number {
		let identity = this.identities.get(value);

		if (identity === undefined) {
			identity = this.identities.size;
			this.identities.set(value, identity);
		}

		return identity;
	}
}
