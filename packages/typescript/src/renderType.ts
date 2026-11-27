import {
	expectDefined,
	isParsedJSONSchemaObject,
	isPlainObject,
	Meta,
	schemaRecord,
	withSourceMeta,
} from '@utilize/json-schema';
import type {
	JSONSchemaTypeName,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { UnresolvedReferenceError } from './errors';
import { indent } from './indent';
import { renderJsDoc } from './jsdoc';
import { stringLiteral } from './literals';
import { finitePropertyNames, mappedKeyType, mappedObjectKeys } from './mappedKeys';
import type { MappedKeySet } from './mappedKeys';
import { declaredKeys, matchesPattern, patternEntries, requiredKeys } from './objectKeys';
import { intersection, parenthesize, union } from './typeExpression';

export { renderJsDoc };

export interface TypeContext {
	/** Name of an already declared standalone schema. */
	nameOf(schema: ParsedJSONSchemaObject, ref: string): string;
	/** Emits a caller-provided TypeScript type for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
}

/**
 * Returns a TypeScript type for a schema node, or `undefined` to use the
 * renderer. Called for every object node, `$ref` nodes and generated copies
 * included. The type replaces the node's type; its JSDoc comment is kept.
 */
export type CustomSchemaResolver = (schema: ParsedJSONSchemaObject) => string | undefined;

/**
 * Keywords that change the rendered type. Everything else — validation
 * keywords, annotations and conditional applicators — has no TypeScript type
 * equivalent and is ignored.
 */
const TYPE_KEYWORDS = new Set([
	'$ref',
	'type',
	'const',
	'enum',
	'allOf',
	'anyOf',
	'oneOf',
	'properties',
	'required',
	'additionalProperties',
	'patternProperties',
	'items',
	'prefixItems',
	'additionalItems',
]);

const OBJECT_KEYWORDS = ['properties', 'patternProperties', 'additionalProperties', 'required'];

const ARRAY_KEYWORDS = ['items', 'prefixItems'];

/**
 * Global types the renderer emits. A schema name must never shadow one of
 * them: `export type Array = Array<string>` refers to the alias itself.
 */
export const RENDERED_GLOBAL_TYPES = ['Array', 'Record'] as const;

export function renderType(
	schema: ParsedJSONSchema | undefined,
	context: TypeContext,
	level = 0
): string {
	const prepared = prepareSchemaInput(schema);

	if (typeof prepared === 'string') {
		return prepared;
	}

	const special = renderSpecialSchema(prepared, context, level);

	if (special !== undefined) {
		return special;
	}

	if (Array.isArray(prepared.allOf) && prepared.allOf.length > 0) {
		return renderAllOf(prepared.allOf, prepared, context, level);
	}

	const unionKeyword = unionKeywordOf(prepared);

	if (unionKeyword !== undefined) {
		return renderUnionApplicator(prepared, unionKeyword, context, level);
	}

	if (Array.isArray(prepared.type)) {
		return renderTypeArray(prepared.type, prepared, context, level);
	}

	return renderTyped(prepared, context, level);
}

function prepareSchemaInput(
	schema: ParsedJSONSchema | undefined
): ParsedJSONSchemaObject | 'unknown' | 'never' {
	if (schema === undefined || schema === null || schema === true) {
		return 'unknown';
	}

	if (schema === false) {
		return 'never';
	}

	return isPlainObject(schema) ? schema : 'unknown';
}

function renderSpecialSchema(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string | undefined {
	const customType = context.customSchemaResolver?.(schema);

	if (customType !== undefined) {
		return customType;
	}

	if (typeof schema.$ref === 'string') {
		return renderReference(schema, context, level);
	}

	if (Object.hasOwn(schema, 'const')) {
		return renderLiteralConstraint([schema.const], 'const', schema, context, level);
	}

	if (Array.isArray(schema.enum)) {
		return renderLiteralConstraint(schema.enum, 'enum', schema, context, level);
	}

	return undefined;
}

function renderAllOf(
	allOf: ParsedJSONSchema[],
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	const parts = allOf.map((subschema) => renderType(subschema, context, level));
	const parent = remainingSchema(schema, 'allOf');

	if (hasRenderableKeywords(parent)) {
		parts.unshift(renderType(parent, context, level));
	}

	return intersection(parts);
}

function unionKeywordOf(schema: ParsedJSONSchemaObject): 'anyOf' | 'oneOf' | undefined {
	if (Array.isArray(schema.anyOf)) {
		return 'anyOf';
	}

	return Array.isArray(schema.oneOf) ? 'oneOf' : undefined;
}

function renderTypeArray(
	types: JSONSchemaTypeName[],
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	if (types.length === 0) {
		return 'never';
	}

	return union(types.map((type) => renderType(withType(schema, type), context, level)));
}

/**
 * `const` and `enum` constrain a schema alongside its other keywords rather
 * than replacing them. A scalar `type` rules out literals of another JSON type
 * (`42 & string` is `never`), so those are filtered; every other remaining
 * keyword is intersected with the literal union.
 */
function renderLiteralConstraint(
	values: unknown[],
	keyword: 'const' | 'enum',
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	const parent = remainingSchema(schema, keyword);
	const declaredType = parent.type;

	if (isScalarType(declaredType) && hasOnlyTypeKeyword(parent)) {
		const matching = values.filter((value) => isOfType(value, declaredType));

		return union(matching.map(renderLiteral));
	}

	const literal = union(values.map(renderLiteral));

	if (!hasRenderableKeywords(parent)) {
		return literal;
	}

	const parentType = renderType(parent, context, level);

	return parentType === 'unknown' ? literal : intersection([literal, parentType]);
}

/**
 * A union applicator only describes one branch of the value; sibling keywords
 * still constrain it, so they are intersected with the union.
 */
function renderUnionApplicator(
	schema: ParsedJSONSchemaObject,
	keyword: 'anyOf' | 'oneOf',
	context: TypeContext,
	level: number
): string {
	const members = schema[keyword];

	if (!Array.isArray(members)) {
		throw new Error(`Expected ${keyword} members`);
	}

	const branch = union(members.map((member) => renderType(member, context, level)));
	const parent = remainingSchema(schema, keyword);

	if (!hasRenderableKeywords(parent)) {
		return branch;
	}

	const parentType = renderType(parent, context, level);

	return parentType === 'unknown' ? branch : intersection([branch, parentType]);
}

function isScalarType(
	type: ParsedJSONSchemaObject['type']
): type is 'string' | 'number' | 'integer' | 'boolean' | 'null' {
	return (
		type === 'string' ||
		type === 'number' ||
		type === 'integer' ||
		type === 'boolean' ||
		type === 'null'
	);
}

function isOfType(
	value: unknown,
	type: 'string' | 'number' | 'integer' | 'boolean' | 'null'
): boolean {
	switch (type) {
		case 'null':
			return value === null;
		case 'integer':
			return typeof value === 'number' && Number.isInteger(value);
		default:
			return typeof value === type;
	}
}

function hasOnlyTypeKeyword(schema: ParsedJSONSchemaObject): boolean {
	const record = schemaRecord(schema);

	for (const keyword of TYPE_KEYWORDS) {
		if (keyword !== 'type' && record[keyword] !== undefined) {
			return false;
		}
	}

	return true;
}

function renderTyped(schema: ParsedJSONSchemaObject, context: TypeContext, level: number): string {
	switch (schema.type) {
		case 'string':
			return 'string';
		case 'number':
		case 'integer':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'null':
			return 'null';
		case 'array':
			return renderArray(schema, context, level);
		case 'object':
			return renderObject(schema, context, level);
		default:
			return renderUntyped(schema, context, level);
	}
}

function renderUntyped(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	const family = inferFamily(schema);

	if (family === 'object') {
		return renderObject(schema, context, level);
	}

	if (family === 'array') {
		return renderArray(schema, context, level);
	}

	return 'unknown';
}

/**
 * A schema without `type` can still have a shape: `properties`, `required` and
 * `patternProperties` describe an object, `items` and `prefixItems` describe an
 * array. Those keywords infer the emitted type, mirroring
 * `json-schema-to-typescript`.
 *
 * Scalar constraints do not infer anything. `maximum` only applies to numbers,
 * so `{ maximum: 3 }` also accepts `"foo"`; typing it as `number` would reject a
 * spec-valid instance. A schema that only bounds values therefore stays
 * `unknown`.
 */
function inferFamily(schema: ParsedJSONSchemaObject): 'object' | 'array' | undefined {
	const record = schemaRecord(schema);

	if (OBJECT_KEYWORDS.some((keyword) => record[keyword] !== undefined)) {
		return 'object';
	}
	// `propertyNames` describes an object only when the key set is finite enough
	// to render; otherwise the schema accepts every JSON type and stays unknown.
	if (finitePropertyNames(schema.propertyNames) !== undefined) {
		return 'object';
	}
	if (ARRAY_KEYWORDS.some((keyword) => record[keyword] !== undefined)) {
		return 'array';
	}

	return undefined;
}

function renderReference(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	const ref = expectDefined(schema.$ref, 'Expected a $ref string');
	const resolved = schema[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(ref);
	}

	if (!isParsedJSONSchemaObject(resolved)) {
		return renderType(resolved, context, level);
	}

	const name = context.nameOf(resolved, ref);
	const siblings = referenceSiblings(schema);

	if (siblings === undefined) {
		return name;
	}

	const siblingType = renderType(siblings, context, level);

	return siblingType === 'unknown' ? name : intersection([name, siblingType]);
}

/**
 * A `$ref` ignores annotations, but newer drafts let it combine with sibling
 * keywords. Those siblings are intersected with the referenced type.
 */
function referenceSiblings(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject | undefined {
	const record = schemaRecord(schema);
	const keys = Object.keys(schema).filter(
		(keyword) => keyword !== '$ref' && TYPE_KEYWORDS.has(keyword) && record[keyword] !== undefined
	);

	if (keys.length === 0) {
		return undefined;
	}

	const sibling = Object.fromEntries(keys.map((key) => [key, record[key]]));

	return withSourceMeta(schema, sibling);
}

function renderLiteral(value: unknown): string {
	if (value === null) {
		return 'null';
	}

	if (typeof value === 'string') {
		return stringLiteral(value);
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(renderLiteral).join(', ')}]`;
	}

	if (isPlainObject(value)) {
		const entries = Object.entries(value);

		if (entries.length === 0) {
			return 'Record<string, never>';
		}

		return `{ ${entries
			.map(([key, entry]) => `${propertyKey(key)}: ${renderLiteral(entry)}`)
			.join('; ')} }`;
	}

	return 'unknown';
}

function renderArray(schema: ParsedJSONSchemaObject, context: TypeContext, level: number): string {
	const items = schema.items;
	const prefixItems = Array.isArray(schema.prefixItems)
		? schema.prefixItems
		: Array.isArray(items)
			? items
			: undefined;

	if (prefixItems === undefined) {
		const item = Array.isArray(items) ? undefined : items;

		return arrayOf(renderType(item ?? true, context, level));
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const type = renderType(item, context, level);

		return index < minItems ? type : `${parenthesize(type)}?`;
	});
	const rest = arrayRest(schema, items);

	if (rest === false) {
		return `[${elements.join(', ')}]`;
	}

	const restType = renderType(rest, context, level);

	return `[${[...elements, `...${arrayOf(restType)}`].join(', ')}]`;
}

function arrayOf(type: string): string {
	return `Array<${type}>`;
}

function arrayRest(
	schema: ParsedJSONSchemaObject,
	items: ParsedJSONSchema | ParsedJSONSchema[] | undefined
): ParsedJSONSchema {
	if (!Array.isArray(items) && Array.isArray(schema.prefixItems)) {
		return items === false ? false : (items ?? true);
	}

	if (schema.additionalItems === false) {
		return false;
	}

	return schema.additionalItems ?? true;
}

function renderObject(schema: ParsedJSONSchemaObject, context: TypeContext, level: number): string {
	const mapped = mappedObjectKeys(schema);

	if (mapped !== undefined) {
		return renderMappedObject(schema, mapped, context, level);
	}

	const body = renderObjectBody(schema, context, level + 1);

	return `{\n${body}\n${indent(level)}}`;
}

function renderMappedObject(
	schema: ParsedJSONSchemaObject,
	set: MappedKeySet,
	context: TypeContext,
	level: number
): string {
	return mappedObjectBodies(schema, set, context, level + 1)
		.map((body) => `{\n${body}\n${indent(level)}}`)
		.join(' & ');
}

/**
 * A mapped type cannot declare properties next to its `[key in …]`, so required
 * properties form an intersection with the mapped key set. The mapped value is
 * widened with the property types for the same assignability reason as an index
 * signature.
 */
function mappedObjectBodies(
	schema: ParsedJSONSchemaObject,
	set: MappedKeySet,
	context: TypeContext,
	memberLevel: number
): string[] {
	const keys = set.keys === undefined ? undefined : new Set(set.keys);
	const declared = declaredKeys(schema).filter(
		(key) => !set.restrictDeclared || keys?.has(key) === true
	);
	const { lines, propertyTypes } = renderProperties(schema, declared, context, memberLevel);
	const keyType = mappedKeyType(set, (schema, ref) => context.nameOf(schema, ref));

	// `never` covers an empty `propertyNames` enum and a pattern that matches
	// nothing. Declared properties may still be allowed by a closed object.
	if (keyType === 'never') {
		return lines.length === 0
			? [`${indent(memberLevel)}[key: string]: never;`]
			: [lines.join('\n')];
	}

	const mapped = `${indent(memberLevel)}[key in ${keyType}]?: ${mappedValueType(schema, set.keys, context, memberLevel, propertyTypes)};`;

	return lines.length === 0 ? [mapped] : [lines.join('\n'), mapped];
}

function mappedValueType(
	schema: ParsedJSONSchemaObject,
	keys: string[] | undefined,
	context: TypeContext,
	level: number,
	propertyTypes: string[]
): string {
	const additional = schema.additionalProperties;
	const parts: string[] = [];

	if (additional !== false) {
		parts.push(isPlainObject(additional) ? renderType(additional, context, level) : 'unknown');
	}

	const patterns = patternEntries(schema);

	for (const [pattern, subschema] of patterns) {
		if (subschema === false) {
			continue;
		}
		// An infinite key set cannot be tested key by key, but every non-false
		// pattern still matches at least one key the mapped type covers.
		if (keys === undefined || keys.some((key) => matchesPattern(pattern, key))) {
			parts.push(renderType(subschema, context, level));
		}
	}

	return union([...parts, ...propertyTypes]);
}

/**
 * Renders the body of an object type: the declared properties and the index
 * signature. The index signature widens `additionalProperties` with
 * `patternProperties`, the declared property types and `undefined` for optional
 * properties, because TypeScript requires every property to be assignable to
 * it.
 */
export function renderObjectBody(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	memberLevel: number
): string {
	const keys = declaredKeys(schema);

	if (keys.length === 0) {
		const index = indexSignatureType(schema, context, [], false, memberLevel);

		return `${indent(memberLevel)}[key: string]: ${index ?? 'never'};`;
	}

	const { lines, propertyTypes, hasOptional } = renderProperties(
		schema,
		keys,
		context,
		memberLevel
	);
	const index = indexSignatureType(schema, context, propertyTypes, hasOptional, memberLevel);

	if (index !== undefined) {
		lines.push(`${indent(memberLevel)}[key: string]: ${index};`);
	}

	return lines.join('\n');
}

interface RenderedProperties {
	lines: string[];
	propertyTypes: string[];
	hasOptional: boolean;
}

/** Declared members, shared by an interface body and a mapped type's intersection. */
function renderProperties(
	schema: ParsedJSONSchemaObject,
	keys: string[],
	context: TypeContext,
	memberLevel: number
): RenderedProperties {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = requiredKeys(schema);
	const lines: string[] = [];
	const propertyTypes: string[] = [];
	let hasOptional = false;

	for (const key of keys) {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		const optional = !required.has(key);
		const type =
			property !== undefined
				? renderType(property, context, memberLevel)
				: implicitPropertyType(schema, key, context, memberLevel);

		hasOptional ||= optional;
		propertyTypes.push(type);
		lines.push(
			...renderJsDoc(property, memberLevel),
			`${indent(memberLevel)}${readonlyModifier(property)}${propertyKey(key)}${optional ? '?' : ''}: ${type};`
		);
	}

	return { lines, propertyTypes, hasOptional };
}

/**
 * The type of a key that `required` names without declaring it in
 * `properties`. A matching `patternProperties` schema applies to it, so
 * `additionalProperties` only decides when no pattern matches.
 */
function implicitPropertyType(
	schema: ParsedJSONSchemaObject,
	key: string,
	context: TypeContext,
	level: number
): string {
	const patterns = isPlainObject(schema.patternProperties) ? schema.patternProperties : {};
	const matches: string[] = [];

	for (const [pattern, subschema] of Object.entries(patterns)) {
		if (matchesPattern(pattern, key)) {
			matches.push(renderType(subschema, context, level));
		}
	}

	if (matches.length > 0) {
		return union(matches);
	}

	return additionalPropertyType(schema, context, level);
}

/** Fallback for a required key that no declared property or pattern covers. */
function additionalPropertyType(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	const additional = schema.additionalProperties;

	if (additional === false) {
		return 'never';
	}

	return isPlainObject(additional) ? renderType(additional, context, level) : 'unknown';
}

function readonlyModifier(schema: ParsedJSONSchema | undefined): string {
	return isPlainObject(schema) && schema.readOnly === true ? 'readonly ' : '';
}

/**
 * TypeScript requires every declared property to be assignable to the index
 * signature, so a typed `additionalProperties` is widened with the declared
 * property types. `additionalProperties: false` produces no index signature at
 * all, which is the closest a structural type can get to a closed object.
 */
function indexSignatureType(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	propertyTypes: string[],
	hasOptional: boolean,
	level: number
): string | undefined {
	const additional = schema.additionalProperties;
	const patterns = isPlainObject(schema.patternProperties)
		? Object.values(schema.patternProperties)
		: [];
	const parts: string[] = [];

	if (additional !== false) {
		parts.push(isPlainObject(additional) ? renderType(additional, context, level) : 'unknown');
	}

	for (const pattern of patterns) {
		parts.push(renderType(pattern, context, level));
	}

	if (parts.length === 0) {
		return undefined;
	}

	if (parts.includes('unknown')) {
		return 'unknown';
	}

	const value = union([...parts, ...propertyTypes]);

	return hasOptional ? union([value, 'undefined']) : value;
}

/**
 * True when the schema renders as a TypeScript interface: an object with no
 * composition. Everything else becomes a type alias. Objects are emitted as
 * interfaces because an interface with an index signature can be recursive,
 * while `type X = Record<string, X>` is rejected as circular.
 *
 * A finite key set becomes a mapped type, which interfaces cannot contain.
 */
export function isObjectDeclaration(schema: ParsedJSONSchemaObject): boolean {
	if (typeof schema.$ref === 'string' || Object.hasOwn(schema, 'const')) {
		return false;
	}
	if (Array.isArray(schema.enum) || Array.isArray(schema.type)) {
		return false;
	}
	if (
		(Array.isArray(schema.allOf) && schema.allOf.length > 0) ||
		Array.isArray(schema.anyOf) ||
		Array.isArray(schema.oneOf)
	) {
		return false;
	}

	if (mappedObjectKeys(schema) !== undefined) {
		return false;
	}

	return (
		schema.type === 'object' || (schema.type === undefined && inferFamily(schema) === 'object')
	);
}

function remainingSchema(
	schema: ParsedJSONSchemaObject,
	keyword: 'allOf' | 'anyOf' | 'oneOf' | 'const' | 'enum'
): ParsedJSONSchemaObject {
	return {
		...schema,
		[keyword]: undefined,
	};
}

function hasRenderableKeywords(schema: ParsedJSONSchemaObject): boolean {
	const record = schemaRecord(schema);

	for (const keyword of TYPE_KEYWORDS) {
		if (keyword === '$ref') {
			continue;
		}
		if (record[keyword] !== undefined) {
			return true;
		}
	}

	return false;
}

function withType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return { ...schema, type };
}

function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : stringLiteral(key);
}
