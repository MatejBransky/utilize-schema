import type { JSONSchema7Object } from 'json-schema';

import type { Dialect } from './dialect';
import { isJSONSchema } from './model';
import type { JSONSchema } from './model';
import type { RuntimeSchema, SchemaLocation } from './validationIndex';
import { isPlainObject } from './utils';

export interface EvaluationAnnotations {
	readonly properties: Set<string>;
	readonly items: Set<number>;
}

export interface EvaluationResult {
	valid: boolean;
	readonly annotations: EvaluationAnnotations;
}

interface AdvancedSchema {
	readonly dependentRequired?: unknown;
	readonly dependentSchemas?: unknown;
	readonly exclusiveMinimum?: unknown;
	readonly exclusiveMaximum?: unknown;
}

interface DecimalParts {
	readonly coefficient: bigint;
	readonly exponent: number;
}

interface ContainsBounds {
	readonly minimum: number;
	readonly maximum: number;
}

type JsonObject = JSONSchema7Object;
type SchemaMap = Record<string, RuntimeSchema>;
type SchemaType = NonNullable<Exclude<JSONSchema['type'], unknown[]>>;
type CountKeyword =
	| 'minLength'
	| 'maxLength'
	| 'minProperties'
	| 'maxProperties'
	| 'minItems'
	| 'maxItems';

const TYPE_MATCHERS: Partial<Record<SchemaType, (value: unknown) => boolean>> = {
	null: (value) => value === null,
	boolean: (value) => typeof value === 'boolean',
	object: (value) => isPlainObject(value),
	array: (value) => Array.isArray(value),
	number: (value) => typeof value === 'number' && Number.isFinite(value),
	integer: (value) => typeof value === 'number' && Number.isInteger(value),
	string: (value) => typeof value === 'string',
};

export interface KeywordContext {
	readonly location: SchemaLocation;
	readonly schema: JSONSchema;
	readonly value: unknown;
	readonly path: string;
	readonly result: EvaluationResult;
	readonly evaluate: (
		schema: unknown,
		value: unknown,
		path: string
	) => EvaluationResult | undefined;
}

export function emptyResult(valid = true): EvaluationResult {
	return { valid, annotations: { properties: new Set(), items: new Set() } };
}

export function mergeEvaluation(target: EvaluationResult, source: EvaluationResult): void {
	if (!source.valid) {
		target.valid = false;
		return;
	}

	for (const property of source.annotations.properties) {
		target.annotations.properties.add(property);
	}

	for (const item of source.annotations.items) {
		target.annotations.items.add(item);
	}
}

export function validateAssertions(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	return (
		validateValue(schema, value, dialect) &&
		validateObject(schema, value, dialect) &&
		validateArray(schema, value, dialect)
	);
}

function validateValue(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	if (applies(dialect, 'type') && !matchesType(value, schema.type)) {
		return false;
	}

	if (!constMatches(schema, value, dialect) || !enumMatches(schema, value, dialect)) {
		return false;
	}

	if (typeof value === 'number') {
		return validateNumber(schema, value, dialect);
	}

	if (typeof value === 'string') {
		return validateString(schema, value, dialect);
	}

	return true;
}

function constMatches(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	return !(
		applies(dialect, 'const') &&
		Object.hasOwn(schema, 'const') &&
		!jsonEqual(value, schema.const)
	);
}

function enumMatches(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	return !(
		applies(dialect, 'enum') &&
		Array.isArray(schema.enum) &&
		!schema.enum.some((item) => jsonEqual(value, item))
	);
}

function validateNumber(schema: JSONSchema, value: number, dialect: Dialect): boolean {
	if (!Number.isFinite(value) || !multipleMatches(schema, value, dialect)) {
		return false;
	}

	const exclusiveMinimum = (schema as AdvancedSchema).exclusiveMinimum;
	const exclusiveMaximum = (schema as AdvancedSchema).exclusiveMaximum;
	if (
		applies(dialect, 'minimum') &&
		hasMinimum(schema.minimum, exclusiveMinimum) &&
		!minimumMatches(value, schema, dialect)
	) {
		return false;
	}

	return !(
		applies(dialect, 'maximum') &&
		hasMaximum(schema.maximum, exclusiveMaximum) &&
		!maximumMatches(value, schema, dialect)
	);
}

function multipleMatches(schema: JSONSchema, value: number, dialect: Dialect): boolean {
	return !(
		applies(dialect, 'multipleOf') &&
		typeof schema.multipleOf === 'number' &&
		!isMultipleOf(value, schema.multipleOf)
	);
}

function hasMinimum(minimum: unknown, exclusive: unknown): boolean {
	return typeof minimum === 'number' || typeof exclusive === 'number';
}

function hasMaximum(maximum: unknown, exclusive: unknown): boolean {
	return typeof maximum === 'number' || typeof exclusive === 'number';
}

function minimumMatches(value: number, schema: JSONSchema, dialect: Dialect): boolean {
	const exclusive = (schema as AdvancedSchema).exclusiveMinimum;
	if (typeof exclusive === 'number' && dialect.exclusiveBounds === 'numeric') {
		return value > exclusive;
	}

	if (exclusive === true && dialect.exclusiveBounds === 'boolean') {
		return value > (schema.minimum ?? -Infinity);
	}

	return value >= (schema.minimum ?? -Infinity);
}

function maximumMatches(value: number, schema: JSONSchema, dialect: Dialect): boolean {
	const exclusive = (schema as AdvancedSchema).exclusiveMaximum;
	if (typeof exclusive === 'number' && dialect.exclusiveBounds === 'numeric') {
		return value < exclusive;
	}

	if (exclusive === true && dialect.exclusiveBounds === 'boolean') {
		return value < (schema.maximum ?? Infinity);
	}

	return value <= (schema.maximum ?? Infinity);
}

function validateString(schema: JSONSchema, value: string, dialect: Dialect): boolean {
	const length = Array.from(value).length;
	if (!countWithinBounds(schema, length, dialect, 'minLength', 'maxLength')) {
		return false;
	}

	if (!applies(dialect, 'pattern') || typeof schema.pattern !== 'string') {
		return true;
	}

	return patternMatches(value, schema.pattern);
}

function patternMatches(value: string, pattern: string): boolean {
	try {
		return new RegExp(pattern, 'u').test(value);
	} catch {
		return false;
	}
}

function countWithinBounds(
	schema: JSONSchema,
	count: number,
	dialect: Dialect,
	minimumKeyword: CountKeyword,
	maximumKeyword: CountKeyword
): boolean {
	const minimum = schema[minimumKeyword];
	if (applies(dialect, minimumKeyword) && typeof minimum === 'number' && count < minimum) {
		return false;
	}

	const maximum = schema[maximumKeyword];
	if (applies(dialect, maximumKeyword) && typeof maximum === 'number' && count > maximum) {
		return false;
	}

	return true;
}

function validateObject(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	if (!isJsonObject(value)) {
		return true;
	}

	const count = Object.keys(value).length;
	if (!countWithinBounds(schema, count, dialect, 'minProperties', 'maxProperties')) {
		return false;
	}

	if (!requiredPropertiesPresent(schema, value, dialect)) {
		return false;
	}

	return !dependentRequiredFails(schema, value, dialect);
}

function requiredPropertiesPresent(
	schema: JSONSchema,
	value: JsonObject,
	dialect: Dialect
): boolean {
	if (!applies(dialect, 'required') || !Array.isArray(schema.required)) {
		return true;
	}

	return !schema.required.some((key) => typeof key === 'string' && !Object.hasOwn(value, key));
}

function dependentRequiredFails(schema: JSONSchema, value: JsonObject, dialect: Dialect): boolean {
	const dependentRequired = (schema as AdvancedSchema).dependentRequired;
	if (!applies(dialect, 'dependentRequired') || !isPlainObject(dependentRequired)) {
		return false;
	}

	return Object.entries(dependentRequired).some(([property, required]) => {
		if (!Object.hasOwn(value, property) || !Array.isArray(required)) {
			return false;
		}

		return required.some((key) => typeof key === 'string' && !Object.hasOwn(value, key));
	});
}

function validateArray(schema: JSONSchema, value: unknown, dialect: Dialect): boolean {
	if (!Array.isArray(value)) {
		return true;
	}

	if (!countWithinBounds(schema, value.length, dialect, 'minItems', 'maxItems')) {
		return false;
	}

	return !(applies(dialect, 'uniqueItems') && schema.uniqueItems === true && hasDuplicates(value));
}

function hasDuplicates(value: unknown[]): boolean {
	for (let left = 0; left < value.length; left += 1) {
		for (let right = left + 1; right < value.length; right += 1) {
			if (jsonEqual(value[left], value[right])) {
				return true;
			}
		}
	}

	return false;
}

function matchesType(value: unknown, type: JSONSchema['type']): boolean {
	if (Array.isArray(type)) {
		return type.some((candidate) => matchesType(value, candidate));
	}

	const matcher = typeof type === 'string' ? TYPE_MATCHERS[type] : undefined;
	return matcher === undefined ? true : matcher(value);
}

function isMultipleOf(value: number, divisor: number): boolean {
	if (!Number.isFinite(divisor) || divisor <= 0) {
		return false;
	}

	const left = decimalParts(value);
	const right = decimalParts(divisor);
	const exponent = left.exponent - right.exponent;
	const numerator = exponent >= 0 ? left.coefficient * 10n ** BigInt(exponent) : left.coefficient;
	const denominator =
		exponent >= 0 ? right.coefficient : right.coefficient * 10n ** BigInt(-exponent);
	return numerator % denominator === 0n;
}

function decimalParts(value: number): DecimalParts {
	const [mantissa, exponent = '0'] = value.toString().split('e');
	const [whole = '0', fraction = ''] = (mantissa ?? '0').split('.');
	const coefficient = BigInt(`${whole}${fraction}`);
	return { coefficient, exponent: Number(exponent) - fraction.length };
}

function jsonEqual(left: unknown, right: unknown): boolean {
	const pending: [unknown, unknown][] = [[left, right]];
	while (pending.length > 0) {
		const pair = pending.pop();
		if (pair === undefined) {
			break;
		}

		const [a, b] = pair;
		if (a === b) {
			continue;
		}

		if (!collectEqualityChildren(a, b, pending)) {
			return false;
		}
	}

	return true;
}

function collectEqualityChildren(
	left: unknown,
	right: unknown,
	pending: [unknown, unknown][]
): boolean {
	if (Array.isArray(left) && Array.isArray(right)) {
		return collectArrayChildren(left, right, pending);
	}

	if (!isJsonObject(left) || !isJsonObject(right)) {
		return false;
	}

	return collectObjectChildren(left, right, pending);
}

function collectArrayChildren(
	left: unknown[],
	right: unknown[],
	pending: [unknown, unknown][]
): boolean {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		pending.push([left[index], right[index]]);
	}

	return true;
}

function collectObjectChildren(
	left: JsonObject,
	right: JsonObject,
	pending: [unknown, unknown][]
): boolean {
	const leftEntries = Object.entries(left);
	const rightValues = new Map<string, unknown>(Object.entries(right));
	if (leftEntries.length !== rightValues.size) {
		return false;
	}

	for (const [key, value] of leftEntries) {
		if (!rightValues.has(key)) {
			return false;
		}

		pending.push([value, rightValues.get(key)]);
	}

	return true;
}

export function evaluateObjectKeywords(context: KeywordContext): void {
	if (!isJsonObject(context.value)) {
		return;
	}

	evaluateProperties(context);
	evaluatePatternProperties(context);
	evaluateAdditionalProperties(context);
	evaluatePropertyNames(context);
	evaluateDependencies(context);
}

function evaluateProperties(context: KeywordContext): void {
	const { schema, result, path } = context;
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	if (!isPlainObject(schema.properties)) {
		return;
	}

	for (const [property, child] of Object.entries(schema.properties)) {
		if (!Object.hasOwn(value, property)) {
			continue;
		}

		evaluateChild(context, child, value[property], childPath(path, property), () => {
			result.annotations.properties.add(property);
		});
	}
}

function evaluatePatternProperties(context: KeywordContext): void {
	const { schema, result, path } = context;
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	if (!isSchemaMap(schema.patternProperties)) {
		return;
	}

	const patterns = compilePatterns(schema.patternProperties);
	if (patterns === undefined) {
		result.valid = false;
		return;
	}

	for (const property of Object.keys(value)) {
		for (const [pattern, child] of patterns) {
			if (!pattern.test(property)) {
				continue;
			}

			evaluateChild(context, child, value[property], childPath(path, property), () => {
				result.annotations.properties.add(property);
			});
		}
	}
}

function compilePatterns(patterns: SchemaMap): [RegExp, unknown][] | undefined {
	const compiled: [RegExp, unknown][] = [];
	for (const [source, schema] of Object.entries(patterns)) {
		try {
			compiled.push([new RegExp(source, 'u'), schema]);
		} catch {
			return undefined;
		}
	}

	return compiled;
}

function evaluateAdditionalProperties(context: KeywordContext): void {
	const { schema, result, path, location } = context;
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	if (
		!applies(location.resource.dialect, 'additionalProperties') ||
		!isJSONSchema(schema.additionalProperties)
	) {
		return;
	}

	const properties = isSchemaMap(schema.properties) ? schema.properties : {};
	const patterns = additionalPropertyPatterns(schema);
	if (patterns === undefined) {
		result.valid = false;
		return;
	}

	for (const property of Object.keys(value)) {
		if (isCoveredProperty(property, properties, patterns)) {
			continue;
		}

		evaluateChild(
			context,
			schema.additionalProperties,
			value[property],
			childPath(path, property),
			() => {
				result.annotations.properties.add(property);
			}
		);
	}
}

function additionalPropertyPatterns(schema: JSONSchema): [RegExp, unknown][] | undefined {
	if (!isSchemaMap(schema.patternProperties)) {
		return [];
	}

	return compilePatterns(schema.patternProperties);
}

function isCoveredProperty(
	property: string,
	properties: SchemaMap,
	patterns: [RegExp, unknown][]
): boolean {
	return (
		Object.hasOwn(properties, property) || patterns.some(([pattern]) => pattern.test(property))
	);
}

function evaluatePropertyNames(context: KeywordContext): void {
	const { schema, path, location } = context;
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	if (!applies(location.resource.dialect, 'propertyNames') || !isJSONSchema(schema.propertyNames)) {
		return;
	}

	for (const property of Object.keys(value)) {
		evaluateChild(
			context,
			schema.propertyNames,
			property,
			childPath(path, `$propertyNames/${property}`)
		);
	}
}

function evaluateDependencies(context: KeywordContext): void {
	const { schema, location } = context;
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	const advanced = schema as AdvancedSchema;
	if (
		applies(location.resource.dialect, 'dependentSchemas') &&
		isSchemaMap(advanced.dependentSchemas)
	) {
		evaluateSchemaDependencies(advanced.dependentSchemas, context);
	}

	if (!applies(location.resource.dialect, 'dependencies') || !isPlainObject(schema.dependencies)) {
		return;
	}

	evaluateLegacyDependencies(Object.entries(schema.dependencies), context, value);
}

function evaluateLegacyDependencies(
	entries: [string, unknown][],
	context: KeywordContext,
	value: JsonObject
): void {
	const { result, evaluate, path, location } = context;
	for (const [property, dependency] of entries) {
		if (!Object.hasOwn(value, property)) {
			continue;
		}

		if (Array.isArray(dependency)) {
			if (
				location.resource.validation &&
				dependency.some((key) => typeof key === 'string' && !Object.hasOwn(value, key))
			) {
				result.valid = false;
			}
		} else {
			const evaluated = evaluate(dependency, value, path);
			if (evaluated === undefined) {
				result.valid = false;
			} else {
				mergeEvaluation(result, evaluated);
			}
		}
	}
}

function evaluateSchemaDependencies(dependencies: SchemaMap, context: KeywordContext): void {
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	for (const [property, dependency] of Object.entries(dependencies)) {
		if (!Object.hasOwn(value, property)) {
			continue;
		}

		const evaluated = context.evaluate(dependency, context.value, context.path);
		if (evaluated === undefined) {
			context.result.valid = false;
		} else {
			mergeEvaluation(context.result, evaluated);
		}
	}
}

export function evaluateArrayKeywords(context: KeywordContext): void {
	const { value } = context;
	if (!Array.isArray(value)) {
		return;
	}

	evaluateTuple(context);
	evaluateContains(context);
}

function evaluateTuple(context: KeywordContext): void {
	const { schema, location } = context;
	const value = context.value;
	if (!Array.isArray(value)) {
		return;
	}
	const dialect = location.resource.dialect;
	const prefix = dialect.tuple === 'prefixItems' ? schema.prefixItems : schema.items;
	if (!Array.isArray(prefix)) {
		evaluateUniformItems(context);
		return;
	}

	for (let index = 0; index < Math.min(prefix.length, value.length); index += 1) {
		evaluateIndex(context, prefix[index], index);
	}

	evaluateAdditionalItems(context, prefix.length);
}

function evaluateAdditionalItems(context: KeywordContext, start: number): void {
	const { schema, location } = context;
	const value = context.value;
	if (!Array.isArray(value)) {
		return;
	}
	const dialect = location.resource.dialect;
	const keyword = dialect.tuple === 'prefixItems' ? 'items' : 'additionalItems';
	const additional = keyword === 'items' ? schema.items : schema.additionalItems;
	if (!applies(dialect, keyword) || !isJSONSchema(additional)) {
		return;
	}

	for (let index = start; index < value.length; index += 1) {
		evaluateIndex(context, additional, index);
	}
}

function evaluateUniformItems(context: KeywordContext): void {
	if (!isJSONSchema(context.schema.items) || !applies(context.location.resource.dialect, 'items')) {
		return;
	}

	const value = context.value;
	if (!Array.isArray(value)) {
		return;
	}
	for (let index = 0; index < value.length; index += 1) {
		evaluateIndex(context, context.schema.items, index);
	}
}

function evaluateIndex(context: KeywordContext, schema: unknown, index: number): void {
	const value = context.value;
	if (!Array.isArray(value)) {
		return;
	}
	evaluateChild(context, schema, value[index], childPath(context.path, String(index)), () => {
		context.result.annotations.items.add(index);
	});
}

function evaluateContains(context: KeywordContext): void {
	const { schema, value, result, location } = context;
	if (
		!applies(location.resource.dialect, 'contains') ||
		!isJSONSchema(schema.contains) ||
		!Array.isArray(value)
	) {
		return;
	}

	const matches = containingIndexes(schema.contains, value, context);
	const { minimum, maximum } = containsBounds(schema, location.resource.dialect.containsCount);
	if (matches.size < minimum || matches.size > maximum) {
		result.valid = false;
		return;
	}

	for (const index of matches) {
		result.annotations.items.add(index);
	}
}

function containingIndexes(
	schema: unknown,
	value: unknown[],
	context: KeywordContext
): Set<number> {
	const matches = new Set<number>();
	for (let index = 0; index < value.length; index += 1) {
		const evaluated = context.evaluate(
			schema,
			value[index],
			childPath(context.path, String(index))
		);
		if (evaluated?.valid) {
			matches.add(index);
		}
	}

	return matches;
}

function containsBounds(schema: JSONSchema, counted: boolean): ContainsBounds {
	const minimum = counted && typeof schema.minContains === 'number' ? schema.minContains : 1;
	const maximum = counted && typeof schema.maxContains === 'number' ? schema.maxContains : Infinity;
	return { minimum, maximum };
}

export function evaluateUnevaluated(context: KeywordContext): void {
	const { location, schema, value } = context;
	if (
		isPlainObject(value) &&
		applies(location.resource.dialect, 'unevaluatedProperties') &&
		isJSONSchema(schema.unevaluatedProperties)
	) {
		evaluateUnevaluatedProperties(context);
	}

	if (
		Array.isArray(value) &&
		applies(location.resource.dialect, 'unevaluatedItems') &&
		isJSONSchema(schema.unevaluatedItems)
	) {
		evaluateUnevaluatedItems(context);
	}
}

function evaluateUnevaluatedProperties(context: KeywordContext): void {
	const value = context.value;
	if (!isJsonObject(value)) {
		return;
	}
	for (const property of Object.keys(value)) {
		if (context.result.annotations.properties.has(property)) {
			continue;
		}

		evaluateChild(
			context,
			context.schema.unevaluatedProperties,
			value[property],
			childPath(context.path, property),
			() => {
				context.result.annotations.properties.add(property);
			}
		);
	}
}

function evaluateUnevaluatedItems(context: KeywordContext): void {
	const value = context.value;
	if (!Array.isArray(value)) {
		return;
	}
	for (let index = 0; index < value.length; index += 1) {
		if (context.result.annotations.items.has(index)) {
			continue;
		}

		evaluateChild(
			context,
			context.schema.unevaluatedItems,
			value[index],
			childPath(context.path, String(index)),
			() => {
				context.result.annotations.items.add(index);
			}
		);
	}
}

function evaluateChild(
	context: KeywordContext,
	schema: unknown,
	value: unknown,
	path: string,
	onValid?: () => void
): void {
	const evaluated = context.evaluate(schema, value, path);
	if (evaluated === undefined || !evaluated.valid) {
		context.result.valid = false;
	} else {
		onValid?.();
	}
}

function isJsonObject(value: unknown): value is JsonObject {
	return isPlainObject(value);
}

function isSchemaMap(value: unknown): value is SchemaMap {
	return isPlainObject(value) && Object.values(value).every(isJSONSchema);
}

function applies(dialect: Dialect, keyword: string): boolean {
	return dialect.keywords.has(keyword);
}

function childPath(path: string, token: string): string {
	return `${path}/${token.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}
