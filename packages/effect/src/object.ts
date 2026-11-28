import {
	expectDefined,
	isKeywordApplicable,
	isParsedJSONSchemaObject,
	isPlainObject,
	narrowUntypedSchema,
} from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { Context } from './context';
import { applyChecks, patternExpression } from './expressions';
import { objectKeys } from './schemaParts';

export function generateObject(schema: ParsedJSONSchemaObject, context: Context): string {
	const { properties, required, keys } = objectKeys(schema);
	const additional = schema.additionalProperties;
	const patterns = patternEntries(schema, context);
	const checks = objectChecks(schema, context);

	if (keys.length === 0) {
		const expression =
			patterns.length > 0
				? 'Schema.Record(Schema.String, Schema.Json)'
				: additional === false
					? 'Schema.Record(Schema.String, Schema.Never)'
					: isPlainObject(additional)
						? `Schema.Record(Schema.String, ${context.generateSchema(additional, context)})`
						: 'Schema.Record(Schema.String, Schema.Json)';

		const additionalChecks =
			patterns.length > 0 ? additionalChecksFor([], additional, context, patterns) : [];

		return applyChecks(expression, [...patternChecks(patterns), ...additionalChecks, ...checks]);
	}

	const fields = keys.map((key) => {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		// A required key without a `properties` entry is validated by a matching
		// pattern or by `additionalProperties`, so the placeholder must not make
		// it unsatisfiable when a pattern applies.
		const expression =
			property !== undefined
				? context.generateSchema(property, context)
				: additional === false && patterns.length === 0
					? 'Schema.Never'
					: isPlainObject(additional) && patterns.length === 0
						? context.generateSchema(additional, context)
						: 'Schema.Json';

		// A computed key keeps `__proto__` from changing the prototype of the
		// object literal passed to `Schema.Struct`.
		const keyExpression = key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);

		return `${keyExpression}: ${
			required.has(key) ? expression : `Schema.optionalKey(${expression})`
		}`;
	});
	// With patterns, a required key without a `properties` entry is checked by
	// its pattern or by `additionalProperties`, so only `properties` are declared.
	const additionalChecks = additionalChecksFor(
		patterns.length > 0 ? Object.keys(properties) : keys,
		additional,
		context,
		patterns
	);

	return applyChecks(
		`Schema.StructWithRest(Schema.Struct({ ${fields.join(', ')} }), [Schema.Record(Schema.String, Schema.Json)])`,
		[...patternChecks(patterns), ...additionalChecks, ...checks]
	);
}

interface PatternEntry {
	pattern: string;
	expression: string;
}

function patternEntries(schema: ParsedJSONSchemaObject, context: Context): PatternEntry[] {
	if (!isPlainObject(schema.patternProperties)) {
		return [];
	}

	return Object.entries(schema.patternProperties).map(([pattern, subschema]) => ({
		pattern,
		expression: context.generateSchema(subschema, context),
	}));
}

/**
 * `patternProperties` applies every matching pattern to a key, so the object is
 * kept open and a filter validates the matching entries.
 */
function patternChecks(patterns: PatternEntry[]): string[] {
	if (patterns.length === 0) {
		return [];
	}

	// One check per pattern keeps every regex and schema at its own type; an
	// array of `[regex, schema]` pairs would widen to a union of both.
	const checks = patterns
		.map(
			({
				pattern,
				expression,
			}) => `if (${patternExpression(pattern)}.test(key) && !Schema.is(${expression})(entry)) {
          return 'Property does not match the pattern schema';
        }`
		)
		.join('\n');

	return [
		`Schema.makeFilter((value) => {
      for (const [key, entry] of Object.entries(value)) {
        ${checks}
      }

      return undefined;
    })`,
	];
}

/**
 * `Schema.Struct` silently strips excess keys and `Schema.Record` validates
 * declared keys too, so excess keys are preserved and validated by a filter.
 */
function additionalChecksFor(
	keys: string[],
	additional: ParsedJSONSchemaObject['additionalProperties'],
	context: Context,
	patterns: PatternEntry[]
): string[] {
	if (additional === undefined || additional === true) {
		return [];
	}

	const isDeclared = knownKeyExpression(keys, patterns);

	if (additional === false) {
		return [
			`Schema.makeFilter((value) => Object.keys(value).every((key) => ${isDeclared}) ? undefined : 'Unexpected property')`,
		];
	}

	const additionalSchema = context.generateSchema(additional, context);

	return [
		`Schema.makeFilter((value) => Object.entries(value).every(([key, entry]) => ${isDeclared} || Schema.is(${additionalSchema})(entry)) ? undefined : 'Property does not match the schema')`,
	];
}

/**
 * Tests whether `key` is declared or matches a pattern. An empty array literal
 * is typed `never[]`, so `[].includes(key)` would not type-check and is left out.
 */
function knownKeyExpression(keys: string[], patterns: PatternEntry[]): string {
	const tests = [
		...(keys.length > 0 ? [`${JSON.stringify(keys)}.includes(key)`] : []),
		...patterns.map(({ pattern }) => `${patternExpression(pattern)}.test(key)`),
	];

	return tests.length > 0 ? tests.join(' || ') : 'false';
}

function objectChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	const checks: string[] = [];

	if (typeof schema.minProperties === 'number') {
		checks.push(`Schema.isMinProperties(${schema.minProperties})`);
	}
	if (typeof schema.maxProperties === 'number') {
		checks.push(`Schema.isMaxProperties(${schema.maxProperties})`);
	}
	if (schema.propertyNames !== undefined && isKeywordApplicable(context.dialect, 'propertyNames')) {
		checks.push(`Schema.isPropertyNames(${context.generateSchema(schema.propertyNames, context)})`);
	}

	const dependencies = dependencyChecks(schema, context);

	if (dependencies !== undefined) {
		checks.push(dependencies);
	}

	return checks;
}

function dependencyChecks(schema: ParsedJSONSchemaObject, context: Context): string | undefined {
	if (!isPlainObject(schema.dependencies)) {
		return undefined;
	}

	const conditions: string[] = [];

	for (const [key, dependency] of Object.entries(schema.dependencies)) {
		const present = `Object.hasOwn(value, ${JSON.stringify(key)})`;

		if (Array.isArray(dependency)) {
			const required = dependency.filter((item): item is string => typeof item === 'string');

			if (required.length === 1) {
				conditions.push(
					`(!${present} || Object.hasOwn(value, ${JSON.stringify(expectDefined(required[0]))}))`
				);
			} else if (required.length > 1) {
				conditions.push(
					`(!${present} || ${JSON.stringify(required)}.every((key) => Object.hasOwn(value, key)))`
				);
			}
		} else if (dependency !== undefined && dependency !== null) {
			conditions.push(
				`(!${present} || Schema.is(${generateDependencySchema(dependency, context)})(value))`
			);
		}
	}

	if (conditions.length === 0) {
		return undefined;
	}

	return `Schema.makeFilter((value) => ${conditions.join(' && ')} ? undefined : 'Object does not satisfy its dependencies')`;
}

/**
 * A schema dependency is evaluated against the object under validation, so an
 * untyped subschema only needs its object branch: type-specific keywords
 * constrain their own type, and no other type can match here. The Zod
 * generator narrows the same way, through `narrowUntypedSchema`.
 */
function generateDependencySchema(dependency: ParsedJSONSchema, context: Context): string {
	if (!isParsedJSONSchemaObject(dependency)) {
		return context.generateSchema(dependency, context);
	}

	// A resolver that keys on the node itself has already had its chance on the
	// original node; asking it again about the narrowed copy would run user code
	// twice for every dependency.
	const custom = context.customSchemaResolver?.(dependency);

	return (
		custom ??
		context.generateSchema(narrowUntypedSchema(dependency, 'object', context.dialect), context)
	);
}
