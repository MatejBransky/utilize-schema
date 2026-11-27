import { isParsedJSONSchemaObject, Meta } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { stringLiteral } from './literals';
import { declaredKeys, matchesPattern, patternEntries } from './objectKeys';
import { patternKeys } from './patternKeys';
import type { PatternKeys } from './patternKeys';
import { union } from './typeExpression';

/**
 * The keys of an object whose key set TypeScript can express as a mapped type.
 * A closed object with an unanchored pattern has an infinite key set, but its
 * template-literal type still rejects a key that the pattern does not match.
 */
export interface MappedKeySet {
	/** Concrete keys when they are enumerable; undefined for an infinite set. */
	keys: string[] | undefined;
	/** Every key must be in `keys`; a pattern only restricts the keys it matches. */
	restrictDeclared: boolean;
	source: KeySource;
}

export type KeySource =
	| { kind: 'alias'; schema: ParsedJSONSchemaObject; ref: string }
	| { kind: 'types'; types: string[] };

export interface KeyUniverse {
	keys: string[];
	source: KeySource;
}

interface StringValues {
	values: string[];
	/** False when the enum also contains a non-string, which is never a key. */
	onlyStrings: boolean;
}

/**
 * A `propertyNames` enum or const makes the key set finite. A `$ref` to such a
 * schema uses the referenced declaration as the key type, so a shared enum keeps
 * its name instead of repeating its literals.
 */
export function finitePropertyNames(schema: ParsedJSONSchema | undefined): KeyUniverse | undefined {
	if (schema === false) {
		return { keys: [], source: { kind: 'types', types: [] } };
	}

	if (!isParsedJSONSchemaObject(schema)) {
		return undefined;
	}

	if (typeof schema.$ref === 'string') {
		const reference = schema[Meta]?.reference;

		if (reference === false) {
			return { keys: [], source: { kind: 'types', types: [] } };
		}

		if (!isParsedJSONSchemaObject(reference)) {
			return undefined;
		}

		const values = stringValues(reference);

		if (values === undefined) {
			return undefined;
		}

		return keyUniverse(values, reference, schema.$ref);
	}

	const values = stringValues(schema);

	return values === undefined ? undefined : keyUniverse(values);
}

function keyUniverse(
	values: StringValues,
	schema?: ParsedJSONSchemaObject,
	ref?: string
): KeyUniverse {
	if (schema !== undefined && ref !== undefined && values.onlyStrings && values.values.length > 0) {
		return { keys: values.values, source: { kind: 'alias', schema, ref } };
	}

	return {
		keys: values.values,
		source: { kind: 'types', types: values.values.map(stringLiteral) },
	};
}

function stringValues(schema: ParsedJSONSchemaObject): StringValues | undefined {
	if (Object.hasOwn(schema, 'const')) {
		return typeof schema.const === 'string'
			? { values: [schema.const], onlyStrings: true }
			: { values: [], onlyStrings: false };
	}

	if (Array.isArray(schema.enum)) {
		const values = [
			...new Set(schema.enum.filter((value): value is string => typeof value === 'string')),
		];

		return { values, onlyStrings: schema.enum.every((value) => typeof value === 'string') };
	}

	return undefined;
}

/**
 * The mapped key set of an object, if TypeScript can express it. A finite
 * `propertyNames` wins; otherwise `additionalProperties: false` closes the
 * object and the patterns can supply the keys.
 */
export function mappedObjectKeys(schema: ParsedJSONSchemaObject): MappedKeySet | undefined {
	const named = finitePropertyNames(schema.propertyNames);

	if (named !== undefined) {
		const keys = allowedKeys(schema, named.keys);
		const source: KeySource =
			keys.length === named.keys.length
				? named.source
				: { kind: 'types', types: keys.map(stringLiteral) };

		return { keys, restrictDeclared: true, source };
	}

	return schema.additionalProperties === false ? mappedPatternKeys(schema) : undefined;
}

/** `false` patterns reject a key even when `additionalProperties` accepts it. */
function allowedKeys(schema: ParsedJSONSchemaObject, keys: string[]): string[] {
	const additional = schema.additionalProperties;
	const patterns = patternEntries(schema);
	const falsePatterns = patterns
		.filter(([, subschema]) => subschema === false)
		.map(([pattern]) => pattern);

	if (additional !== false && falsePatterns.length === 0) {
		return keys;
	}

	const declared = new Set(declaredKeys(schema));

	return keys.filter((key) => isAllowedKey(key, additional, declared, patterns, falsePatterns));
}

function isAllowedKey(
	key: string,
	additional: ParsedJSONSchemaObject['additionalProperties'],
	declared: Set<string>,
	patterns: [string, ParsedJSONSchema][],
	falsePatterns: string[]
): boolean {
	if (falsePatterns.some((pattern) => matchesPattern(pattern, key))) {
		return false;
	}
	if (declared.has(key)) {
		return true;
	}
	if (patterns.some(([pattern]) => matchesPattern(pattern, key))) {
		return true;
	}

	return additional !== false;
}

/**
 * The key set of a closed object comes from its patterns. An anchored pattern
 * gives concrete keys; an unanchored or unbounded one becomes a template-literal
 * type with `${string}` on the open side, which still narrows the mapped type.
 *
 * A `false` pattern removes keys from the other patterns. That is only decidable
 * when every pattern is finite, so a closed object mixing a `false` pattern with
 * an infinite one keeps the index signature.
 */
function mappedPatternKeys(schema: ParsedJSONSchemaObject): MappedKeySet | undefined {
	const patterns = patternEntries(schema);

	if (patterns.length === 0) {
		return undefined;
	}

	const analysis = analyzePatterns(patterns);

	if (analysis === undefined) {
		return undefined;
	}

	const falsePatterns = patterns
		.filter(([, subschema]) => subschema === false)
		.map(([pattern]) => pattern);

	if (falsePatterns.length > 0 && !analysis.allFinite) {
		return undefined;
	}

	const keys = analysis.allFinite
		? [...analysis.everyKey].filter(
				(key) => !falsePatterns.some((pattern) => matchesPattern(pattern, key))
			)
		: undefined;
	const filtered = keys !== undefined && keys.length !== analysis.everyKey.size;
	const types = filtered
		? keys.map(stringLiteral)
		: patterns.flatMap(([pattern, subschema]) => {
				const parsed = analysis.byPattern.get(pattern);

				return subschema === false || parsed === undefined ? [] : [parsed.keyType];
			});

	return {
		keys,
		restrictDeclared: false,
		source: { kind: 'types', types },
	};
}

interface PatternAnalysis {
	byPattern: Map<string, PatternKeys>;
	everyKey: Set<string>;
	allFinite: boolean;
}

function analyzePatterns(patterns: [string, ParsedJSONSchema][]): PatternAnalysis | undefined {
	const byPattern = new Map<string, PatternKeys>();
	const everyKey = new Set<string>();
	let allFinite = true;

	for (const [pattern] of patterns) {
		const keys = patternKeys(pattern);

		if (keys === undefined) {
			return undefined;
		}
		byPattern.set(pattern, keys);

		if (keys.keys === undefined) {
			allFinite = false;
		} else {
			keys.keys.forEach((key) => everyKey.add(key));
		}
	}

	return { byPattern, everyKey, allFinite };
}

export function mappedKeyType(
	set: MappedKeySet,
	nameOf: (schema: ParsedJSONSchemaObject, ref: string) => string
): string {
	return set.source.kind === 'alias'
		? nameOf(set.source.schema, set.source.ref)
		: union(set.source.types);
}
