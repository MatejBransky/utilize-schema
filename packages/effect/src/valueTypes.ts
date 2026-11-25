import { dialectOf, isKeywordApplicable, isPlainObject, Meta } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { typedAlternatives } from './alternatives';
import type { CustomSchemaResolver } from './generator';
import { planReferenceSiblings } from './refSiblings';
import { arrayRest, objectKeys, parentSchema, prefixItemsOf } from './schemaParts';

export interface ValueTypeContext {
	/**
	 * Dialect of the document root. Each node is rendered with its own dialect,
	 * `dialectOf(node, dialect)`; copies keep the `Meta` of their source, so this
	 * fallback only applies to nodes built from scratch.
	 */
	dialect: Dialect;
	/** The value-type alias of a schema in a cycle, when it has one. */
	aliasFor(schema: ParsedJSONSchemaObject): string | undefined;
	/** The exported type alias of a schema outside of a cycle. */
	typeNameFor(schema: ParsedJSONSchemaObject): string;
	/** Nodes it replaces hold caller code of an unknown type, so they render as `unknown`. */
	customSchemaResolver?: CustomSchemaResolver;
}

const VALUE_TYPE_GENERATORS = new Map<
	string,
	(schema: ParsedJSONSchemaObject, context: ValueTypeContext, self: string | undefined) => string
>([
	['string', () => 'string'],
	['number', () => 'number'],
	['integer', () => 'number'],
	['boolean', () => 'boolean'],
	['null', () => 'null'],
	['array', renderArray],
	['object', renderObject],
]);

/**
 * Renders the TypeScript type of a schema that takes part in a reference cycle.
 * Effect schemas recurse through `Schema.suspend`, which makes the inferred type
 * of the generated const reference itself and collapse to `any`, so cyclic
 * schemas get an explicit annotation built from this type instead.
 */
export function renderValueTypeDeclaration(
	name: string,
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	if (isResolvedByCaller(schema, context)) {
		return `type ${name} = unknown;`;
	}

	const record = renderRecordInterface(schema, context, name);

	if (record !== undefined) {
		return `interface ${name} ${record}`;
	}

	return `type ${name} = ${renderValueType(schema, context, name, false)};`;
}

/** True when `customSchemaResolver` replaces the node with an expression of its own. */
function isResolvedByCaller(schema: ParsedJSONSchemaObject, context: ValueTypeContext): boolean {
	return context.customSchemaResolver?.(schema) !== undefined;
}

/**
 * A `type X = Record<string, X>` alias is circular, while an interface index
 * signature defers the reference, so record schemas are emitted as interfaces.
 */
function renderRecordInterface(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string
): string | undefined {
	if (!isRecordCandidate(schema)) {
		return undefined;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = Array.isArray(schema.required) ? schema.required : [];

	if (Object.keys(properties).length > 0 || required.length > 0) {
		return undefined;
	}

	return `{\n\t[key: string]: ${recordValueType(schema, context, self)};\n}`;
}

function isRecordCandidate(schema: ParsedJSONSchemaObject): boolean {
	return !hasLiteralOrReference(schema) && !hasComposition(schema) && !hasNonObjectType(schema);
}

function hasLiteralOrReference(schema: ParsedJSONSchemaObject): boolean {
	return schema.$ref !== undefined || Object.hasOwn(schema, 'const') || Array.isArray(schema.enum);
}

function hasComposition(schema: ParsedJSONSchemaObject): boolean {
	return Array.isArray(schema.allOf) || Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf);
}

function hasNonObjectType(schema: ParsedJSONSchemaObject): boolean {
	return schema.type !== undefined && schema.type !== 'object';
}

function recordValueType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string
): string {
	if (hasPatternProperties(schema)) {
		return 'Schema.Json';
	}

	if (schema.additionalProperties === false) {
		return 'never';
	}

	return isPlainObject(schema.additionalProperties)
		? renderValueType(schema.additionalProperties, context, self, true)
		: 'Schema.Json';
}

/**
 * `deferred` marks positions TypeScript resolves lazily (object members, array
 * elements, index signatures), where a recursive alias is allowed. A direct
 * self reference would be circular, so it degrades to `Schema.Json`.
 */
function renderValueType(
	schema: ParsedJSONSchema,
	context: ValueTypeContext,
	self?: string,
	deferred = true
): string {
	const simple = simpleValueType(schema);

	if (simple !== undefined) {
		return simple;
	}

	const object = schema as ParsedJSONSchemaObject;

	if (isResolvedByCaller(object, context)) {
		return 'unknown';
	}

	const dialect = dialectOf(object, context.dialect);
	const structured = renderStructuredValueType(object, context, self, deferred, dialect);

	if (structured !== undefined) {
		return structured;
	}

	const type = object.type as string | undefined;

	return VALUE_TYPE_GENERATORS.get(type ?? '')?.(object, context, self) ?? 'Schema.Json';
}

function simpleValueType(schema: ParsedJSONSchema): string | undefined {
	if (schema === undefined || schema === null || schema === true) {
		return 'Schema.Json';
	}

	if (schema === false) {
		return 'never';
	}

	return isPlainObject(schema) ? undefined : 'Schema.Json';
}

function renderStructuredValueType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined,
	deferred: boolean,
	dialect: Dialect
): string | undefined {
	return (
		renderReferenceValueType(schema, context, self, deferred, dialect) ??
		renderLiteralValueType(schema, dialect) ??
		renderCombinatorValueType(schema, context, self, deferred) ??
		renderTypeArrayValueType(schema, context)
	);
}

function renderReferenceValueType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined,
	deferred: boolean,
	dialect: Dialect
): string | undefined {
	if (typeof schema.$ref !== 'string') {
		return undefined;
	}

	return renderResolvedReference(schema[Meta]?.reference, schema, context, self, deferred, dialect);
}

function renderResolvedReference(
	reference: ParsedJSONSchema | null | undefined,
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined,
	deferred: boolean,
	dialect: Dialect
): string {
	if (reference === undefined || reference === null) {
		return 'Schema.Json';
	}

	if (typeof reference === 'boolean') {
		return reference ? 'Schema.Json' : 'never';
	}

	const referenceType = renderReferenceTarget(reference, context, self, deferred);
	const siblings = planReferenceSiblings(
		schema,
		dialect,
		(target) => context.aliasFor(target) !== undefined
	);

	// A `merge` generates the merged object, so its value type is rendered from
	// the same schema. A `check` keeps the reference's type: a filter does not
	// change it.
	if (siblings.kind === 'merge') {
		return renderValueType(siblings.merged, context, self, deferred);
	}

	return referenceType;
}

function renderReferenceTarget(
	reference: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined,
	deferred: boolean
): string {
	const alias = context.aliasFor(reference);

	if (alias === undefined) {
		return context.typeNameFor(reference);
	}

	return alias === self && !deferred ? 'Schema.Json' : alias;
}

function renderLiteralValueType(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): string | undefined {
	if (Object.hasOwn(schema, 'const') && isKeywordApplicable(dialect, 'const')) {
		return literalType(schema.const);
	}

	return Array.isArray(schema.enum) ? union(schema.enum.map(literalType)) : undefined;
}

function renderCombinatorValueType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined,
	deferred: boolean
): string | undefined {
	if (Array.isArray(schema.allOf)) {
		return intersection([
			renderValueType(parentSchema(schema), context, self, deferred),
			...schema.allOf.map((subschema) => renderValueType(subschema, context, self, deferred)),
		]);
	}

	const keyword = valueTypeAlternativeKeyword(schema);

	if (keyword === undefined) {
		return undefined;
	}

	const { members } = typedAlternatives(schema, schema[keyword]!);

	return union(members.map((subschema) => renderValueType(subschema, context)));
}

function valueTypeAlternativeKeyword(
	schema: ParsedJSONSchemaObject
): 'anyOf' | 'oneOf' | undefined {
	if (Array.isArray(schema.anyOf)) {
		return 'anyOf';
	}

	return Array.isArray(schema.oneOf) ? 'oneOf' : undefined;
}

function renderTypeArrayValueType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string | undefined {
	if (!Array.isArray(schema.type)) {
		return undefined;
	}

	return union(schema.type.map((type) => renderValueType(schemaWithType(schema, type), context)));
}

function renderArray(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined
): string {
	const dialect = dialectOf(schema, context.dialect);
	const items = schema.items as unknown as ParsedJSONSchema | ParsedJSONSchema[] | undefined;
	const prefixItems = prefixItemsOf(schema, dialect);
	const singleItem = Array.isArray(items) ? undefined : items;

	if (prefixItems === undefined) {
		const item =
			singleItem === undefined || singleItem === true
				? 'Schema.Json'
				: renderValueType(singleItem, context, self, true);

		return `ReadonlyArray<${item}>`;
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const type = renderValueType(item, context, self, true);

		return index < minItems ? type : `${parenthesize(type)}?`;
	});
	const rest = arrayRest(schema, items, dialect);

	if (rest === false) {
		return `readonly [${elements.join(', ')}]`;
	}

	return `readonly [${[...elements, `...${parenthesize(renderValueType(rest, context, self, true))}[]`].join(', ')}]`;
}

function renderObject(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined
): string {
	const { properties, required, keys } = objectKeys(schema);
	const additional = schema.additionalProperties;
	const hasPatterns = hasPatternProperties(schema);

	if (keys.length === 0) {
		if (hasPatterns) {
			return 'Record<string, Schema.Json>';
		}
		if (additional === false) {
			return 'Record<string, never>';
		}
		if (isPlainObject(additional)) {
			return `Record<string, ${renderValueType(additional, context, self, true)}>`;
		}

		return 'Record<string, Schema.Json>';
	}

	const members = keys.map((key) => {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		const type =
			property !== undefined
				? renderValueType(property, context, self, true)
				: additional === false && !hasPatterns
					? 'never'
					: isPlainObject(additional) && !hasPatterns
						? renderValueType(additional, context, self, true)
						: 'Schema.Json';

		return `${propertyKey(key)}${required.has(key) ? '' : '?'}: ${type}`;
	});

	return `{ ${members.join('; ')} }`;
}

/**
 * Mirrors the generator: with `patternProperties` the object stays open and its
 * entries are checked by a filter, so they are typed as `Schema.Json`.
 */
function hasPatternProperties(schema: ParsedJSONSchemaObject): boolean {
	return (
		isPlainObject(schema.patternProperties) && Object.keys(schema.patternProperties).length > 0
	);
}

function schemaWithType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return { ...schema, type };
}

export function literalType(value: unknown): string {
	if (value === null) {
		return 'null';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `readonly [${value.map((entry) => parenthesize(literalType(entry))).join(', ')}]`;
	}
	if (typeof value === 'object') {
		const members = Object.entries(value as Record<string, unknown>).map(
			([key, entry]) => `${propertyKey(key)}: ${literalType(entry)}`
		);

		return `{ ${members.join('; ')} }`;
	}

	return 'never';
}

function union(types: string[]): string {
	const unique = [...new Set(types.filter(Boolean))];

	return unique.length > 0 ? unique.join(' | ') : 'never';
}

function intersection(types: string[]): string {
	const unique = [...new Set(types.filter(Boolean))];

	return unique.length > 0 ? unique.map(parenthesize).join(' & ') : 'Schema.Json';
}

function parenthesize(type: string): string {
	return /[|&]/.test(type) && !type.startsWith('{') && !type.startsWith('readonly [')
		? `(${type})`
		: type;
}

function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
