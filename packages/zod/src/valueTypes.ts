import {
	type Dialect,
	dialectOf,
	isPlainObject,
	Meta,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import { generator as allOfGenerator } from './generators/allOfGenerator';
import { generator as anyGenerator } from './generators/anyGenerator';
import { generator as anyOfGenerator } from './generators/anyOfGenerator';
import { generator as arrayGenerator } from './generators/arrayGenerator';
import { generator as booleanGenerator } from './generators/booleanGenerator';
import { generator as enumGenerator } from './generators/enumGenerator';
import { generator as literalGenerator } from './generators/literalGenerator';
import { generator as multipleTypeGenerator } from './generators/multipleTypeGenerator';
import { generator as nullGenerator } from './generators/nullGenerator';
import { generator as numberGenerator } from './generators/numberGenerator';
import { generator as objectGenerator } from './generators/objectGenerator';
import { generator as oneOfGenerator } from './generators/oneOfGenerator';
import { generator as recordGenerator } from './generators/recordGenerator';
import { generator as refGenerator } from './generators/refGenerator';
import { composedSchemaParts, refSiblingConstraints } from './generators/generateSchema';
import { selectGenerator } from './generators/selectGenerator';
import type { CustomSchemaResolver } from './generators/types';
import { generator as stringGenerator } from './generators/stringGenerator';
import { generator as tupleGenerator, tupleItems, tupleRest } from './generators/tupleGenerator';

export interface ValueTypeContext {
	/**
	 * Dialect of the document root. Each node is rendered with its own dialect,
	 * `dialectOf(node, dialect)`; copies keep the `Meta` of their source, so this
	 * fallback only applies to nodes built from scratch.
	 */
	dialect: Dialect;
	/** The generated value-type alias of a schema in a cycle, when it has one. */
	aliasFor(schema: ParsedJSONSchemaObject): string | undefined;
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
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	if (isResolvedByCaller(schema, context)) {
		return `type ${name} = unknown;`;
	}

	if (context.readOnlyKeyword && schema.readOnly === true) {
		return `type ${name} = ${renderType(schema, context)};`;
	}

	const interfaceBody = renderInterfaceBody(schema, context);

	if (interfaceBody) {
		return `interface ${name} ${interfaceBody}`;
	}

	return `type ${name} = ${renderType(schema, context)};`;
}

/** True when `customSchemaResolver` replaces the node with an expression of its own. */
function isResolvedByCaller(schema: ParsedJSONSchemaObject, context: ValueTypeContext): boolean {
	return context.customSchemaResolver?.(schema) !== undefined;
}

function renderType(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	if (typeof schema !== 'object' || schema === null) {
		return schema ? 'unknown' : 'never';
	}

	if (isResolvedByCaller(schema, context)) {
		return 'unknown';
	}

	const dialect = dialectOf(schema, context.dialect);

	if (context.readOnlyKeyword && schema.readOnly === true && !('$ref' in schema)) {
		return renderReadOnlyType(schema, context);
	}

	const parts = composedSchemaParts(schema);

	if (parts) {
		return `${parenthesize(renderType(parts.main, context))} & ${parenthesize(
			renderType(parts.rest, context)
		)}`;
	}

	const generator = selectGenerator(schema, dialect);

	if (generator === refGenerator) {
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

	if (generator === multipleTypeGenerator) {
		const types = schema.type as unknown as string[];

		return union(
			types.map((type) =>
				renderType(
					{
						...schema,
						type,
						default: undefined,
						title: undefined,
					} as ParsedJSONSchemaObject,
					context
				)
			)
		);
	}

	if (generator === anyOfGenerator || generator === oneOfGenerator) {
		return union(
			(schema.anyOf ?? schema.oneOf ?? []).map((subschema) => renderType(subschema, context))
		);
	}

	if (generator === allOfGenerator) {
		const subschemas = schema.allOf ?? [];

		if (subschemas.length === 0) {
			return 'never';
		}

		if (subschemas.length === 1) {
			return renderType(subschemas[0]!, context);
		}

		return subschemas.map((subschema) => parenthesize(renderType(subschema, context))).join(' & ');
	}

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

	if (generator === recordGenerator) {
		const additionalProperties = schema.additionalProperties as ParsedJSONSchemaObject;

		return `Record<string, ${renderType(additionalProperties, context)}>`;
	}

	if (generator === objectGenerator) {
		const { lines, index } = renderObjectMembers(schema, context);
		const body = lines.join('; ');
		const indexPart = index ? `${body ? '; ' : ''}[key: string]: ${index}` : '';

		return `{ ${body}${indexPart} }`;
	}

	if (generator === tupleGenerator) {
		const items = (tupleItems(schema, dialect) ?? []).map(
			(item) => `${parenthesize(renderType(item, context))}?`
		);
		const rest = renderTupleRest(schema, context, dialect);

		return `[${[...items, rest].filter(Boolean).join(', ')}]`;
	}

	if (generator === arrayGenerator) {
		const items = schema.items
			? renderType(schema.items as ParsedJSONSchemaObject, context)
			: 'unknown';

		return `${parenthesize(items)}[]`;
	}

	if (generator === enumGenerator) {
		return union((schema.enum ?? []).map(literalType));
	}

	if (generator === anyGenerator) {
		return 'unknown';
	}

	return 'unknown';
}

function renderReadOnlyType(schema: ParsedJSONSchemaObject, context: ValueTypeContext): string {
	const generator = selectGenerator(schema, dialectOf(schema, context.dialect));

	if (generator === arrayGenerator) {
		const items = schema.items
			? renderType(schema.items as ParsedJSONSchemaObject, context)
			: 'unknown';

		return `ReadonlyArray<${parenthesize(items)}>`;
	}

	const inner = renderType(
		{ ...schema, readOnly: undefined } as unknown as ParsedJSONSchemaObject,
		context
	);

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
		const additionalProperties = schema.additionalProperties as ParsedJSONSchemaObject;

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

function renderObjectMembers(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): { lines: string[]; index?: string } {
	const properties = Object.entries(schema.properties ?? {});
	const lines: string[] = [];
	const propertyTypes: string[] = [];

	for (const [key, value] of properties) {
		const type = renderType(value, context);
		const optional = !schema.required?.includes(key) && value.default === undefined;

		lines.push(`${propertyKey(key)}${optional ? '?' : ''}: ${type}`);
		propertyTypes.push(type);
	}

	const additionalProperties = schema.additionalProperties;
	let index: string | undefined;

	if (schema.patternProperties && Object.keys(schema.patternProperties).length > 0) {
		// The generator keeps the object open so that matching keys survive the
		// parse, so an index signature is the closest representation.
		index = 'unknown';
	} else if (additionalProperties === true) {
		index = 'unknown';
	} else if (isPlainObject(additionalProperties)) {
		const type = renderType(additionalProperties as ParsedJSONSchemaObject, context);

		index = propertyTypes.length === 0 ? type : union([...propertyTypes, type, 'undefined']);
	}

	const requiredWithoutProperties = (schema.required ?? []).filter(
		(key) => !Object.hasOwn(schema.properties ?? {}, key)
	);
	const requiredType =
		additionalProperties === false
			? 'never'
			: isPlainObject(additionalProperties)
				? renderType(additionalProperties as ParsedJSONSchemaObject, context)
				: 'unknown';

	for (const key of requiredWithoutProperties) {
		lines.push(`${propertyKey(key)}: ${requiredType}`);
	}

	return { lines, index };
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
