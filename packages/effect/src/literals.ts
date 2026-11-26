import { expectDefined } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { Context } from './context';
import { UnsupportedEffectSchemaFeatureError } from './errors';

export function literal(value: unknown, context: Context): string {
	if (value === null) {
		return 'Schema.Null';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return `Schema.Literal(${JSON.stringify(value)})`;
	}

	return structuredLiteral(value, context);
}

export function literals(values: unknown[], context: Context): string {
	if (values.length === 0) {
		return 'Schema.Never';
	}
	if (values.length === 1) {
		return literal(values[0], context);
	}

	if (values.every(isPrimitiveLiteral)) {
		return `Schema.Literals([${values.map((value) => literalValue(value)).join(', ')}])`;
	}

	const members = [...new Set(values.map((value) => literal(value, context)))];

	return members.length === 1 ? expectDefined(members[0]) : `Schema.Union([${members.join(', ')}])`;
}

function literalValue(value: unknown): string {
	if (value === null || typeof value === 'string' || typeof value === 'number') {
		return JSON.stringify(value);
	}
	if (typeof value === 'boolean') {
		return String(value);
	}

	throw new UnsupportedEffectSchemaFeatureError(
		'enum',
		'only primitive values are supported in const and enum'
	);
}

/** JSON Schema compares `const`/`enum` values structurally, ignoring key order. */
function structuredLiteral(value: unknown, context: Context): string {
	return context.jsonLiteralCall(value);
}

/**
 * One helper per generated file keeps the canonical JSON comparison out of every
 * literal. The helper takes the literal's value type as a parameter, so the
 * annotation of a declaration and every call site agree. The replacer it runs is
 * the one `canonicalJson` uses, so the expected string cannot drift from it.
 */
export function jsonLiteralHelper(): string {
	return `<T>(expected: string) => Schema.Json.check(Schema.makeFilter((value) => JSON.stringify(value, ${canonicalReplacer.toString()}) === expected)) as unknown as Schema.Codec<T>`;
}

/**
 * Sorts the keys of every object by code point, not by the build machine's
 * locale, so `canonicalJson` and the emitted helper serialize the same value the
 * same way. Integer-like keys keep their JSON.stringify order, which both sides
 * share.
 */
function canonicalReplacer(_key: string, entry: unknown) {
	if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
		return Object.fromEntries(
			Object.entries(entry).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		);
	}

	return entry;
}

export function canonicalJson(value: unknown): string {
	return JSON.stringify(value, canonicalReplacer) ?? '';
}

function isPrimitiveLiteral(value: unknown): boolean {
	return value === null || typeof value !== 'object';
}

/** A `const` or `enum` value that needs a value type, because Effect has no literal form for it. */
export function hasStructuredLiteral(schema: ParsedJSONSchemaObject): boolean {
	if (Object.hasOwn(schema, 'const')) {
		return !isPrimitiveLiteral(schema.const);
	}

	return Array.isArray(schema.enum) && schema.enum.some((value) => !isPrimitiveLiteral(value));
}
