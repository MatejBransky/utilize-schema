import type { Dialect } from './dialect';
import type { RuntimeSchemaBundle } from './runtimeSchema';
import { isJSONSchema, isJSONSchemaObject } from './model';
import type { JSONSchema } from './model';
import { createValidationIndex } from './validationIndex';
import type {
	ResolvedSchemaReference,
	SchemaLocation,
	SchemaResource,
	ValidationIndex,
} from './validationIndex';
import {
	emptyResult,
	evaluateArrayKeywords,
	evaluateObjectKeywords,
	evaluateUnevaluated,
	mergeEvaluation,
	validateAssertions,
} from './validationEvaluate';
import type { EvaluationResult, KeywordContext } from './validationEvaluate';
import { isPlainObject } from './utils';

export type JsonSchemaValidator = (value: unknown, ref: string) => boolean;

type ActiveLocations = Map<SchemaLocation, Set<string>>;

const REFERENCE_KEYWORDS = ['$ref', '$recursiveRef', '$dynamicRef'] as const;
type ReferenceKeyword = (typeof REFERENCE_KEYWORDS)[number];

interface AdvancedSchema {
	readonly $dynamicAnchor?: unknown;
}

/**
 * Creates a browser-safe validator over the bundle's original schema documents.
 * Format assertion belongs to the generated target projection, not this guard.
 */
export function createJsonSchemaValidator(
	bundle: RuntimeSchemaBundle | string
): JsonSchemaValidator {
	const resolved = typeof bundle === 'string' ? parseBundle(bundle) : bundle;
	const index = createValidationIndex(resolved);

	return (value, ref) => {
		const target = index.resolve(ref, resolved.rootUri);
		if (target === undefined) {
			return false;
		}

		return evaluateSchema(target.location, value, '', [], new Map(), index).valid;
	};
}

function parseBundle(serialized: string): RuntimeSchemaBundle {
	const value: unknown = JSON.parse(serialized);

	if (!isRuntimeSchemaBundle(value)) {
		throw new TypeError('Invalid JSON Schema runtime bundle');
	}

	return value;
}

function isRuntimeSchemaBundle(value: unknown): value is RuntimeSchemaBundle {
	return (
		isPlainObject(value) &&
		typeof value.rootUri === 'string' &&
		isPlainObject(value.documents) &&
		(value.dialect === '2019-09' || value.dialect === '2020-12')
	);
}

function evaluateSchema(
	location: SchemaLocation,
	value: unknown,
	path: string,
	scopes: readonly SchemaResource[],
	active: ActiveLocations,
	index: ValidationIndex
): EvaluationResult {
	if (typeof location.schema === 'boolean') {
		return emptyResult(location.schema);
	}

	if (isActive(location, path, active)) {
		return emptyResult();
	}

	active.set(location, withPath(active.get(location), path));
	const nextScopes = enterResource(scopes, location.resource);

	try {
		return evaluateObject(location, value, path, nextScopes, active, index);
	} finally {
		removePath(active, location, path);
	}
}

function evaluateObject(
	location: SchemaLocation,
	value: unknown,
	path: string,
	scopes: readonly SchemaResource[],
	active: ActiveLocations,
	index: ValidationIndex
): EvaluationResult {
	const schema = location.schema;
	if (!isJSONSchemaObject(schema)) {
		return emptyResult(false);
	}

	const dialect = location.resource.dialect;
	if (typeof schema.$ref === 'string' && dialect.refSiblings === 'ignore') {
		const target = resolveReference('$ref', schema.$ref, location, scopes, index);
		return target === undefined
			? emptyResult(false)
			: evaluateSchema(target, value, path, scopes, active, index);
	}

	const result = emptyResult();
	if (!evaluateReferences(schema, location, value, path, scopes, active, index, result)) {
		return result;
	}

	if (location.resource.validation && !validateAssertions(schema, value, dialect)) {
		result.valid = false;
		return result;
	}

	const context = {
		location,
		schema,
		value,
		path,
		result,
		evaluate: (child: unknown, childValue: unknown, childLocation: string) => {
			const target = index.child(location, child);
			return target === undefined
				? undefined
				: evaluateSchema(target, childValue, childLocation, scopes, active, index);
		},
	};

	evaluateObjectKeywords(context);
	evaluateArrayKeywords(context);
	evaluateCombinators(context);
	if (result.valid) {
		evaluateUnevaluated(context);
	}

	return result;
}

function evaluateReferences(
	schema: JSONSchema,
	location: SchemaLocation,
	value: unknown,
	path: string,
	scopes: readonly SchemaResource[],
	active: ActiveLocations,
	index: ValidationIndex,
	result: EvaluationResult
): boolean {
	const dialect = location.resource.dialect;
	for (const keyword of REFERENCE_KEYWORDS) {
		const ref = referenceForKeyword(schema, keyword, dialect);
		if (ref === undefined) {
			continue;
		}

		if (!evaluateReference(keyword, ref, location, value, path, scopes, active, index, result)) {
			return false;
		}
	}

	return true;
}

function referenceForKeyword(
	schema: JSONSchema,
	keyword: ReferenceKeyword,
	dialect: Dialect
): string | undefined {
	if (!dialect.keywords.has(keyword)) {
		return undefined;
	}

	const ref = schema[keyword];
	return typeof ref === 'string' ? ref : undefined;
}

function evaluateReference(
	keyword: ReferenceKeyword,
	ref: string,
	location: SchemaLocation,
	value: unknown,
	path: string,
	scopes: readonly SchemaResource[],
	active: ActiveLocations,
	index: ValidationIndex,
	result?: EvaluationResult
): boolean {
	const target = resolveReference(keyword, ref, location, scopes, index);
	if (target === undefined) {
		return false;
	}

	const evaluated = evaluateSchema(target, value, path, scopes, active, index);
	if (result === undefined) {
		return evaluated.valid;
	}

	mergeEvaluation(result, evaluated);
	return evaluated.valid;
}

function resolveReference(
	keyword: ReferenceKeyword,
	ref: string,
	location: SchemaLocation,
	scopes: readonly SchemaResource[],
	index: ValidationIndex
): SchemaLocation | undefined {
	const initial = index.resolve(ref, location.baseUri);
	return initial === undefined ? undefined : referenceTarget(keyword, initial, scopes);
}

function referenceTarget(
	keyword: ReferenceKeyword,
	initial: ResolvedSchemaReference,
	scopes: readonly SchemaResource[]
): SchemaLocation {
	if (keyword === '$recursiveRef' && initial.location.resource.recursiveAnchor) {
		return (
			outermost(scopes, (resource) => resource.recursiveAnchor)?.rootLocation ?? initial.location
		);
	}

	if (keyword !== '$dynamicRef' || !isDynamicTarget(initial)) {
		return initial.location;
	}

	const name = initial.fragment;
	return (
		outermost(scopes, (resource) => resource.dynamicAnchors.has(name))?.dynamicAnchors.get(name) ??
		initial.location
	);
}

function isDynamicTarget(reference: ResolvedSchemaReference): boolean {
	if (reference.fragment === '' || reference.fragment.startsWith('/')) {
		return false;
	}

	const schema = reference.location.schema;
	return (
		isJSONSchemaObject(schema) && (schema as AdvancedSchema).$dynamicAnchor === reference.fragment
	);
}

function evaluateCombinators(context: KeywordContext): void {
	const { schema, location } = context;
	const dialect = location.resource.dialect;
	if (dialect.keywords.has('allOf')) {
		evaluateAllOf(context);
	}

	if (dialect.keywords.has('anyOf')) {
		evaluateBranches(context, 'anyOf', false);
	}

	if (dialect.keywords.has('oneOf')) {
		evaluateBranches(context, 'oneOf', true);
	}

	if (dialect.keywords.has('not') && isJSONSchema(schema.not)) {
		const evaluated = context.evaluate(schema.not, context.value, context.path);
		if (evaluated === undefined || evaluated.valid) {
			context.result.valid = false;
		}
	}

	if (dialect.keywords.has('if')) {
		evaluateConditional(context);
	}
}

function evaluateAllOf(context: KeywordContext): void {
	if (!Array.isArray(context.schema.allOf)) {
		return;
	}

	for (const child of context.schema.allOf) {
		const evaluated = context.evaluate(child, context.value, context.path);
		if (evaluated === undefined) {
			context.result.valid = false;
		} else {
			mergeEvaluation(context.result, evaluated);
		}
	}
}

function evaluateBranches(
	context: KeywordContext,
	keyword: 'anyOf' | 'oneOf',
	exactlyOne: boolean
): void {
	const branches = context.schema[keyword];
	if (!Array.isArray(branches)) {
		return;
	}

	const successful: EvaluationResult[] = [];
	for (const branch of branches) {
		const evaluated = context.evaluate(branch, context.value, context.path);
		if (evaluated?.valid) {
			successful.push(evaluated);
		}
	}

	const valid = exactlyOne ? successful.length === 1 : successful.length > 0;
	if (!valid) {
		context.result.valid = false;
		return;
	}

	for (const evaluated of successful) {
		mergeEvaluation(context.result, evaluated);
	}
}

function evaluateConditional(context: KeywordContext): void {
	const { schema } = context;
	if (!isJSONSchema(schema.if)) {
		return;
	}

	const condition = context.evaluate(schema.if, context.value, context.path);
	if (condition === undefined) {
		context.result.valid = false;
		return;
	}

	if (condition.valid) {
		mergeEvaluation(context.result, condition);
	}

	const selected = condition.valid ? schema.then : schema.else;
	if (!isJSONSchema(selected)) {
		return;
	}

	const evaluated = context.evaluate(selected, context.value, context.path);
	if (evaluated === undefined) {
		context.result.valid = false;
	} else {
		mergeEvaluation(context.result, evaluated);
	}
}

function outermost(
	scopes: readonly SchemaResource[],
	predicate: (resource: SchemaResource) => boolean
): SchemaResource | undefined {
	return scopes.find(predicate);
}

function enterResource(
	scopes: readonly SchemaResource[],
	resource: SchemaResource
): readonly SchemaResource[] {
	return scopes.at(-1) === resource ? scopes : [...scopes, resource];
}

function isActive(location: SchemaLocation, path: string, active: ActiveLocations): boolean {
	return active.get(location)?.has(path) ?? false;
}

function withPath(paths: Set<string> | undefined, path: string): Set<string> {
	const next = new Set(paths);
	next.add(path);
	return next;
}

function removePath(active: ActiveLocations, location: SchemaLocation, path: string): void {
	const paths = active.get(location);
	paths?.delete(path);
	if (paths?.size === 0) {
		active.delete(location);
	}
}
