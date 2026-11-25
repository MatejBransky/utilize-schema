import {
	expectDefined,
	isPlainObject,
	Meta,
	schemaRecord,
	toSafeString,
	withSourceMeta,
} from '@utilize/json-schema';
import type {
	JSONSchemaTypeName,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { UnresolvedReferenceError } from './errors';

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

const INDENT = '\t';

function indent(level: number): string {
	return INDENT.repeat(level);
}

export function renderType(schema: ParsedJSONSchema, context: TypeContext, level = 0): string {
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
	schema: ParsedJSONSchema
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
	const members = schema[keyword] as ParsedJSONSchema[];
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
	const ref = schema.$ref as string;
	const resolved = schema[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(ref);
	}

	if (!isPlainObject(resolved)) {
		return renderType(resolved, context, level);
	}

	const name = context.nameOf(resolved as ParsedJSONSchemaObject, ref);
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

	const sibling: Record<string, unknown> = {};

	for (const key of keys) {
		sibling[key] = record[key];
	}

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
	const items = schema.items as ParsedJSONSchema | ParsedJSONSchema[] | undefined;
	const prefixItems = Array.isArray(schema.prefixItems)
		? (schema.prefixItems as ParsedJSONSchema[])
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

	return (schema.additionalItems as ParsedJSONSchema | undefined) ?? true;
}

function renderObject(schema: ParsedJSONSchemaObject, context: TypeContext, level: number): string {
	const body = renderObjectBody(schema, context, level + 1);

	return `{\n${body}\n${indent(level)}}`;
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

	const index = indexSignatureType(schema, context, propertyTypes, hasOptional, memberLevel);

	if (index !== undefined) {
		lines.push(`${indent(memberLevel)}[key: string]: ${index};`);
	}

	return lines.join('\n');
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

/** JSON Schema patterns are unanchored ECMA-262 regular expressions. */
function matchesPattern(pattern: string, key: string): boolean {
	try {
		return new RegExp(pattern).test(key);
	} catch {
		return false;
	}
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

function declaredKeys(schema: ParsedJSONSchemaObject): string[] {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};

	return [...new Set([...Object.keys(properties), ...requiredKeys(schema)])];
}

function requiredKeys(schema: ParsedJSONSchemaObject): Set<string> {
	return new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === 'string')
			: []
	);
}

/**
 * True when the schema renders as a TypeScript interface: an object with no
 * composition. Everything else becomes a type alias. Objects are emitted as
 * interfaces because an interface with an index signature can be recursive,
 * while `type X = Record<string, X>` is rejected as circular.
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

	return (
		schema.type === 'object' || (schema.type === undefined && inferFamily(schema) === 'object')
	);
}

/**
 * JSDoc for annotations that describe the value rather than constrain it.
 * Validation keywords are intentionally omitted: they cannot be expressed in a
 * TypeScript type, so repeating them in a comment would imply guarantees the
 * type does not make.
 *
 * `declarationName` is the name of the emitted declaration. A title that would
 * only repeat it is left out, because the generator derives that name from the
 * title in the first place.
 */
export function renderJsDoc(
	schema: ParsedJSONSchema | undefined,
	level = 0,
	declarationName?: string
): string[] {
	if (!isPlainObject(schema)) {
		return [];
	}

	const node = schema as ParsedJSONSchemaObject;
	const lines = jsDocText(node, declarationName);
	const tags = jsDocTags(node);

	if (lines.length > 0 && tags.length > 0) {
		lines.push('');
	}
	lines.push(...tags);

	if (lines.length === 0) {
		return [];
	}

	const prefix = indent(level);

	return [
		`${prefix}/**`,
		...lines.map((line) => `${prefix} * ${escapeComment(line)}`.trimEnd()),
		`${prefix} */`,
	];
}

function jsDocText(schema: ParsedJSONSchemaObject, declarationName?: string): string[] {
	const lines: string[] = [];
	const title = typeof schema.title === 'string' ? schema.title.trim() : '';
	const description = typeof schema.description === 'string' ? schema.description.trim() : '';
	const titleRepeatsName =
		declarationName !== undefined && title.length > 0 && toSafeString(title) === declarationName;

	for (const text of [titleRepeatsName ? '' : title, description]) {
		if (text.length > 0) {
			lines.push(...text.split('\n'));
		}
	}

	return lines;
}

function jsDocTags(schema: ParsedJSONSchemaObject): string[] {
	const tags: string[] = [];

	if (schema.deprecated === true) {
		tags.push('@deprecated');
	}
	if (schema.default !== undefined) {
		tags.push(`@default ${JSON.stringify(schema.default)}`);
	}
	if (typeof schema.format === 'string') {
		tags.push(`@format ${schema.format}`);
	}
	if (Array.isArray(schema.examples)) {
		for (const example of schema.examples) {
			tags.push(`@example ${JSON.stringify(example)}`);
		}
	}

	return tags;
}

function escapeComment(text: string): string {
	return text.replaceAll('*/', String.raw`*\/`);
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

/** Single-quoted string literal, matching the repository's code style. */
function stringLiteral(value: string): string {
	const json = JSON.stringify(value);

	return `'${json
		.slice(1, -1)
		.replaceAll(String.raw`\"`, '"')
		.replaceAll("'", String.raw`\'`)}'`;
}

function union(types: string[]): string {
	const unique = [...new Set(types.filter((type) => type !== 'never'))];

	if (unique.length === 0) {
		return 'never';
	}

	if (unique.includes('unknown')) {
		return 'unknown';
	}

	return unique.join(' | ');
}

function intersection(types: string[]): string {
	const unique = [...new Set(types.filter((type) => type !== 'unknown'))];

	if (unique.includes('never')) {
		return 'never';
	}

	if (unique.length === 0) {
		return 'unknown';
	}

	if (unique.length === 1) {
		return expectDefined(unique[0]);
	}

	return unique.map(parenthesize).join(' & ');
}

function parenthesize(type: string): string {
	return hasTopLevelOperator(type) ? `(${type})` : type;
}

/**
 * True when `type` combines at a depth of zero with `|` or `&`, so it has to be
 * parenthesized before it becomes an intersection member or an optional tuple
 * element. An object or tuple body may contain unions of its own; those are
 * already delimited and must not be wrapped.
 */
const CHARACTER_QUOTE = 1;
const CHARACTER_OPEN = 2;
const CHARACTER_CLOSE = 3;
const CHARACTER_OPERATOR = 4;
const CHARACTER_KINDS = new Uint8Array(128);

CHARACTER_KINDS[34] = CHARACTER_QUOTE;
CHARACTER_KINDS[39] = CHARACTER_QUOTE;
CHARACTER_KINDS[123] = CHARACTER_OPEN;
CHARACTER_KINDS[91] = CHARACTER_OPEN;
CHARACTER_KINDS[40] = CHARACTER_OPEN;
CHARACTER_KINDS[60] = CHARACTER_OPEN;
CHARACTER_KINDS[125] = CHARACTER_CLOSE;
CHARACTER_KINDS[93] = CHARACTER_CLOSE;
CHARACTER_KINDS[41] = CHARACTER_CLOSE;
CHARACTER_KINDS[62] = CHARACTER_CLOSE;
CHARACTER_KINDS[124] = CHARACTER_OPERATOR;
CHARACTER_KINDS[38] = CHARACTER_OPERATOR;

function hasTopLevelOperator(type: string): boolean {
	let depth = 0;
	let quote: number | undefined;

	for (let index = 0; index < type.length; index++) {
		const code = type.charCodeAt(index);

		if (quote !== undefined) {
			if (code === 92) {
				index++;
			} else {
				quote = updatedQuote(code, quote);
			}

			continue;
		}

		const kind = CHARACTER_KINDS[code];

		if (kind === CHARACTER_QUOTE) {
			quote = code;
		} else if (kind === CHARACTER_OPEN) {
			depth++;
		} else if (kind === CHARACTER_CLOSE) {
			depth = Math.max(0, depth - 1);
		} else if (kind === CHARACTER_OPERATOR && depth === 0) {
			return true;
		}
	}

	return false;
}

function updatedQuote(code: number, quote: number): number | undefined {
	return code === quote ? undefined : quote;
}
