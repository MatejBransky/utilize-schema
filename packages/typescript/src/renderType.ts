import {
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { UnresolvedReferenceError } from './errors';

export interface TypeContext {
	/** Name of an already declared standalone schema. */
	nameOf(schema: ParsedJSONSchemaObject, ref: string): string;
}

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

const INDENT = '\t';

export function indent(level: number): string {
	return INDENT.repeat(level);
}

export function renderType(schema: ParsedJSONSchema, context: TypeContext, level = 0): string {
	if (schema === undefined || schema === null || schema === true) {
		return 'unknown';
	}

	if (schema === false) {
		return 'never';
	}

	if (!isPlainObject(schema)) {
		return 'unknown';
	}

	if (typeof schema.$ref === 'string') {
		return renderReference(schema, context, level);
	}

	if (Object.hasOwn(schema, 'const')) {
		return renderLiteral(schema.const);
	}

	if (Array.isArray(schema.enum)) {
		return schema.enum.length === 0 ? 'never' : union(schema.enum.map(renderLiteral));
	}

	if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
		const parts = schema.allOf.map((subschema) => renderType(subschema, context, level));
		const parent = remainingSchema(schema);

		if (hasRenderableKeywords(parent)) {
			parts.unshift(renderType(parent, context, level));
		}

		return intersection(parts);
	}

	if (Array.isArray(schema.anyOf)) {
		return union(schema.anyOf.map((subschema) => renderType(subschema, context, level)));
	}

	if (Array.isArray(schema.oneOf)) {
		return union(schema.oneOf.map((subschema) => renderType(subschema, context, level)));
	}

	if (Array.isArray(schema.type)) {
		if (schema.type.length === 0) {
			return 'never';
		}

		return union(
			schema.type.map((type) =>
				renderType(withType(schema, type as ParsedJSONSchemaObject['type']), context, level)
			)
		);
	}

	return renderTyped(schema, context, level);
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
	const record = schema as unknown as Record<string, unknown>;

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
	const record = schema as unknown as Record<string, unknown>;
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

	return sibling as unknown as ParsedJSONSchemaObject;
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
	const items = schema.items as unknown as ParsedJSONSchema | ParsedJSONSchema[] | undefined;
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

	return (schema.additionalItems as unknown as ParsedJSONSchema | undefined) ?? true;
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
				: additionalPropertyType(schema, context, memberLevel);

		hasOptional ||= optional;
		propertyTypes.push(type);
		lines.push(...renderJsDoc(property, memberLevel));
		lines.push(
			`${indent(memberLevel)}${readonlyModifier(property)}${propertyKey(key)}${optional ? '?' : ''}: ${type};`
		);
	}

	const index = indexSignatureType(schema, context, propertyTypes, hasOptional, memberLevel);

	if (index !== undefined) {
		lines.push(`${indent(memberLevel)}[key: string]: ${index};`);
	}

	return lines.join('\n');
}

/** The type of a key that `required` names without declaring it in `properties`. */
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

export function declaredKeys(schema: ParsedJSONSchemaObject): string[] {
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
 */
export function renderJsDoc(schema: ParsedJSONSchema | undefined, level = 0): string[] {
	if (!isPlainObject(schema)) {
		return [];
	}

	const lines: string[] = [];
	const title = typeof schema.title === 'string' ? schema.title.trim() : '';
	const description = typeof schema.description === 'string' ? schema.description.trim() : '';

	for (const text of [title, description]) {
		if (text.length > 0) {
			lines.push(...text.split('\n'));
		}
	}

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

function escapeComment(text: string): string {
	return text.replace(/\*\//g, '*\\/');
}

function remainingSchema(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return {
		...schema,
		allOf: undefined,
		anyOf: undefined,
		oneOf: undefined,
	} as unknown as ParsedJSONSchemaObject;
}

function hasRenderableKeywords(schema: ParsedJSONSchemaObject): boolean {
	const record = schema as unknown as Record<string, unknown>;

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

export function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : stringLiteral(key);
}

/** Single-quoted string literal, matching the repository's code style. */
function stringLiteral(value: string): string {
	const json = JSON.stringify(value);

	return `'${json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
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
		return unique[0]!;
	}

	return unique.map(parenthesize).join(' & ');
}

function parenthesize(type: string): string {
	return /[|&]/.test(type) && !type.startsWith('{') && !type.startsWith('[') ? `(${type})` : type;
}
