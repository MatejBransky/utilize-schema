import { childSchemasOf, dialectOf, isPlainObject, Meta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { withoutAlwaysValidAnyOf } from './generators/alwaysValidAnyOf';
import { ignoresRefSiblings } from './generators/generateSchema';

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

export interface InlineCopiesResult {
	/** Every inline subschema that is generated as a reference instead. */
	copies: InlineCopies;
	/**
	 * Declarations created for inline subschemas that repeat without a named
	 * schema, in the order their first copy appears.
	 */
	hoisted: ParsedJSONSchemaObject[];
}

/**
 * Finds inline subschemas that the generator refers to instead of generating
 * them again:
 *
 * - a copy of a standalone schema, e.g. a `oneOf` that schemars inlined next to
 *   the definition it came from, refers to that schema;
 * - a subschema that appears several times but has no named schema is hoisted
 *   into a declaration of its own, which every copy refers to.
 *
 * Only schemas whose generated code has subschemas count: a lone
 * `{ "type": "string" }` is shorter than a reference.
 *
 * Two schemas are identical when they have the same keywords and values, the
 * same dialect, and every `$ref` resolves to the same schema.
 */
export function findInlineCopies(
	standaloneSchemas: ParsedJSONSchemaObject[],
	isOpaque: (schema: ParsedJSONSchemaObject) => boolean
): InlineCopiesResult {
	const keys = new StructuralKeys();
	const containsOpaque = opaqueSubtreeCheck(isOpaque);
	const isCandidate = (schema: ParsedJSONSchemaObject) =>
		isComposite(schema) && !containsOpaque(schema);
	const declarations = new Map<string, ParsedJSONSchemaObject>();

	for (const schema of standaloneSchemas) {
		const key = keys.of(schema);

		if (isCandidate(schema) && !declarations.has(key)) {
			declarations.set(key, schema);
		}
	}

	const copies = new Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>();
	const inline = collectInlineCandidates(standaloneSchemas, {
		keys,
		declarations,
		isCandidate,
		isOpaque,
	});

	for (const [key, occurrences] of inline.occurrences) {
		const declaration = declarations.get(key);

		if (declaration) {
			for (const occurrence of occurrences) {
				copies.set(occurrence, declaration);
			}
		}
	}

	const hoisted = hoistRepeatedSchemas(inline, declarations, copies);

	return { copies, hoisted };
}

interface InlineCandidates {
	/** Inline candidates grouped by structural key, in the order they appear. */
	occurrences: Map<string, ParsedJSONSchemaObject[]>;
	/** The nearest enclosing inline candidate of each candidate. */
	enclosing: Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>;
	/** Position of each candidate in a depth-first walk. */
	order: Map<ParsedJSONSchemaObject, number>;
}

interface InlineSearch {
	keys: StructuralKeys;
	/** Standalone schemas with subschemas, by structural key. */
	declarations: ReadonlyMap<string, ParsedJSONSchemaObject>;
	isCandidate: (schema: ParsedJSONSchemaObject) => boolean;
	/** True for a node whose code the caller provides. */
	isOpaque: (schema: ParsedJSONSchemaObject) => boolean;
}

/**
 * Collects the inline subschemas that may become a reference. The walk covers
 * only subschemas the generator turns into code: it does not enter a copy of a
 * standalone schema, which is generated as part of that schema, nor a node
 * whose code the caller provides.
 */
function collectInlineCandidates(
	standaloneSchemas: ParsedJSONSchemaObject[],
	{ keys, declarations, isCandidate, isOpaque }: InlineSearch
): InlineCandidates {
	const standalone = new Set(standaloneSchemas);
	const candidates: InlineCandidates = {
		occurrences: new Map(),
		enclosing: new Map(),
		order: new Map(),
	};

	function visit(schema: ParsedJSONSchemaObject, enclosing: ParsedJSONSchemaObject | undefined) {
		for (const child of generatedChildSchemasOf(schema)) {
			if (standalone.has(child) || isOpaque(child)) {
				continue;
			}

			if (!isCandidate(child)) {
				visit(child, enclosing);
				continue;
			}

			const key = keys.of(child);
			const occurrences = candidates.occurrences.get(key);

			if (occurrences) {
				occurrences.push(child);
			} else {
				candidates.occurrences.set(key, [child]);
			}

			candidates.order.set(child, candidates.order.size);

			if (enclosing) {
				candidates.enclosing.set(child, enclosing);
			}

			if (!declarations.has(key)) {
				visit(child, child);
			}
		}
	}

	for (const schema of standaloneSchemas) {
		if (!isOpaque(schema)) {
			visit(schema, undefined);
		}
	}

	return candidates;
}

/**
 * Creates a declaration for every inline subschema that is generated at least
 * twice and adds its copies to `copies`. A subschema counts only where it is
 * generated: inside the first copy of a hoisted schema, which becomes the
 * declaration, but not inside the other copies, which become references.
 */
function hoistRepeatedSchemas(
	{ occurrences, enclosing, order }: InlineCandidates,
	declarations: ReadonlyMap<string, ParsedJSONSchemaObject>,
	copies: Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>
): ParsedJSONSchemaObject[] {
	/** Each hoisted declaration and the first copy it was made from. */
	const hoisted = new Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>();

	const isGenerated = (schema: ParsedJSONSchemaObject) => {
		for (let outer = enclosing.get(schema); outer; outer = enclosing.get(outer)) {
			const declaration = copies.get(outer);

			if (declaration && hoisted.get(declaration) !== outer) {
				return false;
			}
		}

		return true;
	};

	// A schema's key contains the keys of its subschemas, so sorting by length
	// decides every schema before the schemas inside it.
	const repeated = [...occurrences]
		.filter(([key, schemas]) => schemas.length > 1 && !declarations.has(key))
		.sort(([a], [b]) => b.length - a.length);

	for (const [, schemas] of repeated) {
		const generated = schemas.filter(isGenerated);

		if (generated.length < 2) {
			continue;
		}

		const source = generated[0]!;
		const declaration = declarationFrom(source);
		hoisted.set(declaration, source);

		for (const schema of generated) {
			copies.set(schema, declaration);
		}
	}

	return [...hoisted]
		.map(([declaration, source]) => ({ declaration, position: order.get(source)! }))
		.sort((a, b) => a.position - b.position)
		.map(({ declaration }) => declaration);
}

/**
 * A declaration with the keywords of its first copy. It is a new object, so the
 * generator can tell the declaration from the reference that replaces the copy.
 */
function declarationFrom(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	const { isCircular: _isCircular, resolvedName: _resolvedName, ...meta } = schema[Meta];
	const declaration = { ...schema };

	Object.defineProperty(declaration, Meta, {
		enumerable: false,
		configurable: true,
		writable: true,
		value: meta,
	});

	return declaration;
}

/**
 * True when `isOpaque` matches the schema or a node inside it. Such a schema
 * may be generated differently from an identical one elsewhere, e.g. when a
 * `customSchemaResolver` matches nodes by their path.
 */
function opaqueSubtreeCheck(
	isOpaque: (schema: ParsedJSONSchemaObject) => boolean
): (schema: ParsedJSONSchemaObject) => boolean {
	const results = new Map<ParsedJSONSchemaObject, boolean>();

	return function containsOpaque(schema) {
		let result = results.get(schema);

		if (result === undefined) {
			result = isOpaque(schema) || childSchemasOf(schema).some(containsOpaque);
			results.set(schema, result);
		}

		return result;
	};
}

function isComposite(schema: ParsedJSONSchemaObject): boolean {
	if (ignoresRefSiblings(schema, dialectOf(schema))) {
		return false;
	}

	const generated = withoutAlwaysValidAnyOf(schema);

	return compositeKeywords.some((keyword) => generated[keyword] !== undefined);
}

/**
 * The subschemas the generator turns into code. It leaves out an `anyOf` that
 * accepts every value and the keywords a dialect ignores next to a `$ref`.
 */
function generatedChildSchemasOf(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] {
	if (ignoresRefSiblings(schema, dialectOf(schema))) {
		return [];
	}

	return childSchemasOf(withoutAlwaysValidAnyOf(schema));
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
			key = Array.isArray(value)
				? this.ofArray(value)
				: this.ofObject(value as Record<string, unknown>);
			this.keys.set(value, key);
		}

		return key;
	}

	private ofArray(values: unknown[]): string {
		return `[${values.map((value) => this.of(value)).join(',')}]`;
	}

	private ofObject(value: Record<string, unknown>): string {
		if (!isPlainObject(value)) {
			return `#${this.identityOf(value)}`;
		}

		const meta = (value as Partial<ParsedJSONSchemaObject>)[Meta];
		const keywords = Object.keys(value);
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
