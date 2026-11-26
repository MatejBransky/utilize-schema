import {
	dialectOf,
	expectDefined,
	isParsedJSONSchemaObject,
	Meta,
	withSourceMeta,
} from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { allOfGenerator } from './generators/allOfGenerator';
import { withoutAlwaysValidAnyOf } from './generators/alwaysValidAnyOf';
import { anyGenerator } from './generators/anyGenerator';
import { anyOfGenerator } from './generators/anyOfGenerator';
import { arrayGenerator } from './generators/arrayGenerator';
import { booleanGenerator } from './generators/booleanGenerator';
import { enumGenerator } from './generators/enumGenerator';
import { literalGenerator } from './generators/literalGenerator';
import { multipleTypeGenerator } from './generators/multipleTypeGenerator';
import { nullGenerator } from './generators/nullGenerator';
import { numberGenerator } from './generators/numberGenerator';
import { objectGenerator } from './generators/objectGenerator';
import { oneOfGenerator } from './generators/oneOfGenerator';
import { recordGenerator } from './generators/recordGenerator';
import { composedSchemaParts, refSiblingConstraints } from './generators/schemaParts';
import { selectGenerator } from './generators/selectGenerator';
import type { CustomSchemaResolver } from './generators/types';
import { stringGenerator } from './generators/stringGenerator';
import { tupleGenerator, tupleItems, tupleRest } from './generators/tupleGenerator';
import { isRefNode, isResolvedByCaller } from './utils';

export interface ValueTypeContext {
	/**
	 * Dialect of the document root. Each node is rendered with its own dialect,
	 * `dialectOf(node, dialect)`; copies keep the `Meta` of their source, so this
	 * fallback only applies to nodes built from scratch.
	 */
	dialect: Dialect;
	/** The generated value-type alias of a schema in a cycle, when it has one. */
	aliasFor(schema: ParsedJSONSchemaObject): string | undefined;
	/** The standalone schema an inline subschema is an identical copy of, if any. */
	declarationOf?(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject | undefined;
	/** The exported type alias of a schema, for schemas outside of a cycle. */
	typeNameFor(schema: ParsedJSONSchemaObject): string;
	/** Mirror `readOnlyKeyword` in the value types. */
	readOnlyKeyword?: boolean;
	/** Nodes it replaces hold caller code of an unknown type, so they render as `unknown`. */
	customSchemaResolver?: CustomSchemaResolver;
}

/**
 * Renders the TypeScript value type of a parsed schema, mirroring the Zod
 * expression the generators produce.
 */
export function renderValueTypeDeclaration(
	name: string,
	declaration: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	if (isResolvedByCaller(context.customSchemaResolver, declaration)) {
		return `type ${name} = unknown;`;
	}

	const schema = withoutAlwaysValidAnyOf(declaration);

	if (context.readOnlyKeyword && schema.readOnly === true) {
		return `type ${name} = ${renderType(schema, context)};`;
	}

	const interfaceBody = renderInterfaceBody(schema, context);

	if (interfaceBody) {
		return `interface ${name} ${interfaceBody}`;
	}

	return `type ${name} = ${renderType(schema, context)};`;
}

function renderType(node: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	if (typeof node !== 'object' || node === null) {
		return node ? 'unknown' : 'never';
	}

	if (isResolvedByCaller(context.customSchemaResolver, node)) {
		return 'unknown';
	}

	const declaration = context.declarationOf?.(node);

	if (declaration) {
		return context.aliasFor(declaration) ?? context.typeNameFor(declaration);
	}

	return renderNormalizedType(node, context);
}

function renderNormalizedType(node: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	const schema = withoutAlwaysValidAnyOf(node);
	const dialect = dialectOf(schema, context.dialect);

	if (isRefNode(schema)) {
		return renderReferenceType(schema, dialect, context);
	}

	if (context.readOnlyKeyword && schema.readOnly === true) {
		return renderReadOnlyType(schema, context);
	}

	const parts = composedSchemaParts(schema);

	if (parts) {
		return `${parenthesize(renderType(parts.main, context))} & ${parenthesize(
			renderType(parts.rest, context)
		)}`;
	}

	return renderGeneratedType(schema, dialect, context);
}

function renderGeneratedType(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect,
	context: ValueTypeContext
): string {
	const generator = selectGenerator(schema, dialect);

	if (generator === multipleTypeGenerator) {
		return renderTypeList(schema, context);
	}

	if (generator === anyOfGenerator || generator === oneOfGenerator) {
		return renderUnionType(schema, context);
	}

	if (generator === allOfGenerator) {
		return renderAllOfType(schema, context);
	}

	const scalar = renderScalarType(generator, schema);

	if (scalar !== undefined) {
		return scalar;
	}

	const collection = renderCollectionType(generator, schema, dialect, context);

	if (collection !== undefined) {
		return collection;
	}

	return renderFallbackType(generator, schema);
}

function renderFallbackType(
	generator: ReturnType<typeof selectGenerator>,
	schema: ParsedJSONSchemaObject
): string {
	if (generator === enumGenerator) {
		return union((schema.enum ?? []).map(literalType));
	}

	if (generator === anyGenerator) {
		return 'unknown';
	}

	return 'unknown';
}

function renderUnionType(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	return union(
		(schema.anyOf ?? schema.oneOf ?? []).map((subschema) => renderType(subschema, context))
	);
}

function renderAllOfType(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	const subschemas = schema.allOf ?? [];

	if (subschemas.length === 0) {
		return 'never';
	}

	if (subschemas.length === 1) {
		return renderType(expectDefined(subschemas[0]), context);
	}

	return subschemas.map((subschema) => parenthesize(renderType(subschema, context))).join(' & ');
}

function renderScalarType(
	generator: ReturnType<typeof selectGenerator>,
	schema: ParsedJSONSchemaObject
): string | undefined {
	if (generator === nullGenerator) {
		return 'null';
	}

	if (generator === literalGenerator) {
		return literalType(schema.const);
	}

	if (generator === booleanGenerator) {
		return 'boolean';
	}

	if (generator === numberGenerator) {
		return 'number';
	}

	if (generator === stringGenerator) {
		return 'string';
	}

	return undefined;
}

function renderCollectionType(
	generator: ReturnType<typeof selectGenerator>,
	schema: ParsedJSONSchemaObject,
	dialect: Dialect,
	context: ValueTypeContext
): string | undefined {
	if (generator === recordGenerator) {
		return renderRecordCollectionType(schema, context);
	}

	if (generator === objectGenerator) {
		return renderObjectCollectionType(schema, context);
	}

	if (generator === tupleGenerator) {
		return renderTupleCollectionType(schema, dialect, context);
	}

	if (generator === arrayGenerator) {
		return renderArrayCollectionType(schema, context);
	}

	return undefined;
}

function renderRecordCollectionType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	const additionalProperties = schema.additionalProperties;

	if (!isParsedJSONSchemaObject(additionalProperties)) {
		return 'unknown';
	}

	return `Record<string, ${renderType(additionalProperties, context)}>`;
}

function renderObjectCollectionType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	const { lines, index } = renderObjectMembers(schema, context);
	const body = lines.join('; ');
	const indexPart = index ? `${body ? '; ' : ''}[key: string]: ${index}` : '';

	return `{ ${body}${indexPart} }`;
}

function renderTupleCollectionType(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect,
	context: ValueTypeContext
): string {
	const items = (tupleItems(schema, dialect) ?? []).map(
		(item) => `${parenthesize(renderType(item, context))}?`
	);
	const rest = renderTupleRest(schema, context, dialect);

	return `[${[...items, rest].filter(Boolean).join(', ')}]`;
}

function renderArrayCollectionType(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	const items = isParsedJSONSchemaObject(schema.items)
		? renderType(schema.items, context)
		: 'unknown';

	return `${parenthesize(items)}[]`;
}

/**
 * Mirrors `generateCore`: the referenced type, intersected with the keywords
 * next to `$ref` only when the dialect applies them (2019-09 and newer).
 */
function renderReferenceType(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect,
	context: ValueTypeContext
): string {
	const reference = schema[Meta]?.reference;

	if (reference === undefined || reference === null) {
		return 'unknown';
	}

	if (typeof reference !== 'object') {
		return reference ? 'unknown' : 'never';
	}

	const referenceType = context.aliasFor(reference) ?? context.typeNameFor(reference);
	const siblings = dialect.refSiblings === 'apply' ? refSiblingConstraints(schema) : undefined;

	if (siblings) {
		return `${referenceType} & ${parenthesize(renderType(siblings, context))}`;
	}

	return referenceType;
}

/** The union of a `type` list; each branch keeps `readOnly`, like `.readonly()` on the union. */
function renderTypeList(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	const types = Array.isArray(schema.type) ? schema.type : [];

	return union(
		types.map((type) =>
			renderType(
				withSourceMeta(schema, { ...schema, type, default: undefined, title: undefined }),
				context
			)
		)
	);
}

function renderReadOnlyType(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	const generator = selectGenerator(schema, dialectOf(schema, context.dialect));

	if (generator === multipleTypeGenerator) {
		return renderTypeList(schema, context);
	}

	if (generator === arrayGenerator) {
		const items = isParsedJSONSchemaObject(schema.items)
			? renderType(schema.items, context)
			: 'unknown';

		return `ReadonlyArray<${parenthesize(items)}>`;
	}

	const inner = renderType({ ...schema, readOnly: undefined }, context);

	if (
		generator === objectGenerator ||
		generator === recordGenerator ||
		generator === tupleGenerator
	) {
		return `Readonly<${inner}>`;
	}

	return inner;
}

function renderInterfaceBody(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string | undefined {
	const generator = selectGenerator(schema, dialectOf(schema, context.dialect));

	if (generator === recordGenerator) {
		const additionalProperties = schema.additionalProperties;

		if (!isParsedJSONSchemaObject(additionalProperties)) {
			return '{\n\t[key: string]: unknown;\n}';
		}

		return `{\n\t[key: string]: ${renderType(additionalProperties, context)};\n}`;
	}

	if (generator !== objectGenerator) {
		return undefined;
	}

	const { lines, index } = renderObjectMembers(schema, context);

	if (!index) {
		return undefined;
	}

	const members = lines.map((line) => `\t${line};`).join('\n');

	return `{\n${members}\n\t[key: string]: ${index};\n}`;
}

function renderObjectMembers(schema: ParsedJSONSchemaObject, context: ValueTypeContext) {
	const lines: string[] = [];
	const propertyTypes: string[] = [];

	for (const [key, value] of Object.entries(schema.properties ?? {})) {
		const type = renderType(value, context);
		const optional = !schema.required?.includes(key) && value.default === undefined;

		lines.push(`${propertyKey(key)}${optional ? '?' : ''}: ${type}`);
		propertyTypes.push(type);
	}

	const index = renderIndexSignature(schema, propertyTypes, context);
	const requiredType =
		schema.additionalProperties === false
			? 'never'
			: isParsedJSONSchemaObject(schema.additionalProperties)
				? renderType(schema.additionalProperties, context)
				: 'unknown';
	const requiredWithoutProperties = (schema.required ?? []).filter(
		(key) => !Object.hasOwn(schema.properties ?? {}, key)
	);

	for (const key of requiredWithoutProperties) {
		lines.push(`${propertyKey(key)}: ${requiredType}`);
	}

	return { lines, index };
}

function renderIndexSignature(
	schema: ParsedJSONSchemaObject,
	propertyTypes: string[],
	context: ValueTypeContext
): string | undefined {
	const additionalProperties = schema.additionalProperties;

	if (schema.patternProperties && Object.keys(schema.patternProperties).length > 0) {
		// The generator keeps the object open so that matching keys survive the
		// parse, so an index signature is the closest representation.
		return 'unknown';
	}

	if (additionalProperties === true) {
		return 'unknown';
	}

	if (isParsedJSONSchemaObject(additionalProperties)) {
		const type = renderType(additionalProperties, context);

		return propertyTypes.length === 0 ? type : union([...propertyTypes, type, 'undefined']);
	}

	return undefined;
}

function renderTupleRest(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	dialect: Dialect
): string {
	const rest = tupleRest(schema, dialect);

	if (rest === false) {
		return '';
	}

	if (rest === undefined || rest === true || rest === null) {
		return '...unknown[]';
	}

	return `...${parenthesize(renderType(rest, context))}[]`;
}

function literalType(value: unknown): string {
	if (value === null) {
		return 'null';
	}

	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}

	return JSON.stringify(value) ?? 'unknown';
}

function union(types: string[]): string {
	const unique = [...new Set(types.filter(Boolean))];

	return unique.length > 0 ? unique.join(' | ') : 'never';
}

function parenthesize(type: string): string {
	return /[|&]/.test(type) ? `(${type})` : type;
}

function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
