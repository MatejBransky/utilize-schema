import { dialectOf } from './dialect';
import {
	isParsedJSONSchema,
	isParsedJSONSchemaObject,
	Meta,
	Source,
	sourceDocumentOf,
} from './model';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject, Path } from './model';
import { isPlainObject } from './utils';

type Shape = (schema: ParsedJSONSchema) => ParsedJSONSchema;
type ShapeBuilder = Partial<ParsedJSONSchemaObject>;

const ANNOTATION_KEYWORDS = [
	'$schema',
	'$id',
	'id',
	'$anchor',
	'$recursiveAnchor',
	'$dynamicAnchor',
	'$vocabulary',
	'$comment',
	'title',
	'description',
	'default',
	'examples',
	'readOnly',
	'writeOnly',
	'deprecated',
	'format',
] as const satisfies readonly (keyof JSONSchema)[];

/**
 * Projects a parsed schema onto the structure a target decoder needs. The
 * shared runtime guard validates the original document; this projection keeps
 * types, defaults and metadata without re-enforcing context-sensitive keywords.
 */
export function createRuntimeShape(
	root: ParsedJSONSchema,
	validationEnabled: (node: ParsedJSONSchemaObject) => boolean = () => true
): ParsedJSONSchema {
	const copies = new Map<ParsedJSONSchemaObject, ParsedJSONSchemaObject>();

	function shape(node: ParsedJSONSchema): ParsedJSONSchema {
		if (typeof node !== 'object' || node === null) {
			return node;
		}

		const existing = copies.get(node);

		if (existing) {
			return existing;
		}

		const result: ShapeBuilder = {};
		copyMeta(node, result, shape);

		if (!isParsedJSONSchemaObject(result)) {
			throw new TypeError('Expected a parsed schema with metadata');
		}

		copies.set(node, result);
		const source = sourceNode(node);

		copyAnnotations(node, source, result, validationEnabled);
		copyLiteralShape(node, source, result, validationEnabled);
		copyReference(node, result);
		copyObjectShape(node, source, result, shape);
		copyArrayShape(node, source, result, shape);
		copyCombinators(node, source, result, shape);

		return result;
	}

	return shape(root);
}

function copyMeta(node: ParsedJSONSchemaObject, result: ShapeBuilder, shape: Shape): void {
	const source = node[Meta];

	if (!source) {
		return;
	}

	const meta = { ...source };
	const document = sourceDocumentOf(node);
	delete meta.reference;
	Object.defineProperty(meta, 'resolvedName', {
		enumerable: true,
		configurable: true,
		get: () => source.resolvedName,
		set: (value: string | undefined) => {
			source.resolvedName = value;
		},
	});
	Object.defineProperty(result, Meta, { enumerable: false, configurable: true, value: meta });

	if (document) {
		Object.defineProperty(result, Source, {
			enumerable: false,
			configurable: true,
			value: document,
		});
	}

	if (typeof source.reference === 'object' && source.reference !== null) {
		const reference = source.reference;
		Object.defineProperty(meta, 'reference', {
			enumerable: true,
			configurable: true,
			get: () => shape(reference),
		});
	} else if (source.reference !== undefined) {
		meta.reference = source.reference;
	}
}

function copyAnnotations(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	validationEnabled: (node: ParsedJSONSchemaObject) => boolean
): void {
	const raw = source ?? node;

	for (const keyword of ANNOTATION_KEYWORDS) {
		const value = raw[keyword];

		if (value !== undefined && (keyword !== 'format' || validationEnabled(node))) {
			setField(result, keyword, value);
		}
	}
}

function copyLiteralShape(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	validationEnabled: (node: ParsedJSONSchemaObject) => boolean
): void {
	if (!validationEnabled(node)) {
		return;
	}

	const raw = source ?? node;

	for (const keyword of ['type', 'required', 'const', 'enum'] as const) {
		const value: unknown = raw[keyword];

		if (value !== undefined) {
			setField(result, keyword, value);
		}
	}
}

function copyReference(node: ParsedJSONSchemaObject, result: ShapeBuilder): void {
	for (const keyword of ['$ref', '$recursiveRef', '$dynamicRef'] as const) {
		const value = node[keyword];

		if (typeof value === 'string') {
			setField(result, keyword, value);
		}
	}
}

function copyObjectShape(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	shape: Shape
): void {
	const raw = source ?? node;

	copySchemaMap(raw.properties, node.properties, result, 'properties', shape);
	copySchemaMap(raw.patternProperties, node.patternProperties, result, 'patternProperties', shape);

	if (raw.additionalProperties !== undefined && isParsedJSONSchema(node.additionalProperties)) {
		setField(result, 'additionalProperties', shape(node.additionalProperties));
	}

	copySchemaMap(raw.$defs, node.$defs, result, '$defs', shape);
	copySchemaMap(raw.definitions, node.definitions, result, 'definitions', shape);
}

function copySchemaMap(
	raw: unknown,
	parsed: unknown,
	result: ShapeBuilder,
	keyword: 'properties' | 'patternProperties' | '$defs' | 'definitions',
	shape: Shape
): void {
	if (!isPlainObject(raw) || !isPlainObject(parsed)) {
		return;
	}

	const entries: [string, ParsedJSONSchema][] = [];

	for (const [key, value] of Object.entries(parsed)) {
		if (isParsedJSONSchema(value)) {
			entries.push([key, shape(value)]);
		}
	}

	setField(result, keyword, Object.fromEntries(entries));
}

function copyArrayShape(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	shape: Shape
): void {
	if (dialectOf(node).tuple === 'prefixItems') {
		copyPrefixItemsShape(node, source, result, shape);
		return;
	}

	copyLegacyItemsShape(node, source, result, shape);
}

function copyPrefixItemsShape(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	shape: Shape
): void {
	const raw = source ?? node;

	if (Array.isArray(raw.prefixItems) && Array.isArray(node.prefixItems)) {
		setField(result, 'prefixItems', node.prefixItems.map(shape));
	}

	setField(result, 'items', arrayItemShape(raw.items, node.items, shape));
}

function copyLegacyItemsShape(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	shape: Shape
): void {
	const raw = source ?? node;

	if (Array.isArray(raw.items) && Array.isArray(node.items)) {
		setField(result, 'items', node.items.map(shape));
		setField(
			result,
			'additionalItems',
			raw.additionalItems === undefined ? true : shape(node.additionalItems ?? true)
		);
		return;
	}

	if (raw.items !== undefined) {
		setField(result, 'items', arrayItemShape(raw.items, node.items, shape));
	}
}

function arrayItemShape(raw: unknown, parsed: unknown, shape: Shape): ParsedJSONSchema | true {
	if (raw === undefined || Array.isArray(parsed)) {
		return true;
	}

	return isParsedJSONSchema(parsed) ? shape(parsed) : true;
}

function copyCombinators(
	node: ParsedJSONSchemaObject,
	source: JSONSchema | undefined,
	result: ShapeBuilder,
	shape: Shape
): void {
	const raw = source ?? node;
	const allOf = shapeArray(raw.allOf, node.allOf, shape);
	const anyOf = shapeArray(raw.anyOf, node.anyOf, shape);
	const oneOf = shapeArray(raw.oneOf, node.oneOf, shape);

	if (allOf.length > 0) {
		setField(result, 'allOf', allOf);
	}

	if (oneOf.length > 0) {
		// The guard already counted matching branches. A union preserves the
		// decoder's output type without rejecting overlapping structural shapes.
		if (anyOf.length > 0) {
			const intersection = withMeta(node, {});
			setField(intersection, 'anyOf', anyOf);
			setField(result, 'allOf', [...allOf, intersection]);
		}

		setField(result, 'anyOf', oneOf);
		return;
	}

	if (anyOf.length > 0) {
		setField(result, 'anyOf', anyOf);
	}
}

function shapeArray(raw: unknown, parsed: unknown, shape: Shape): ParsedJSONSchema[] {
	if (!Array.isArray(raw) || !Array.isArray(parsed)) {
		return [];
	}

	const schemas: ParsedJSONSchema[] = [];

	for (let index = 0; index < parsed.length; index += 1) {
		const candidate: unknown = parsed[index] ?? raw[index];

		if (isParsedJSONSchema(candidate)) {
			schemas.push(shape(candidate));
		}
	}

	return schemas;
}

function withMeta(node: ParsedJSONSchemaObject, value: ShapeBuilder): ParsedJSONSchemaObject {
	if (node[Meta]) {
		Object.defineProperty(value, Meta, {
			enumerable: false,
			configurable: true,
			value: node[Meta],
		});
	}

	if (!isParsedJSONSchemaObject(value)) {
		throw new TypeError('Expected a parsed schema with metadata');
	}

	return value;
}

function sourceNode(node: ParsedJSONSchemaObject): JSONSchema | undefined {
	const source = sourceDocumentOf(rootOfDocument(node))?.schema;

	return source === undefined ? undefined : nodeAtPath(source, node[Meta]?.path ?? []);
}

function rootOfDocument(node: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	let current = node;

	while (current[Meta]?.parent) {
		const parent = current[Meta].parent;

		if (!parent || typeof parent !== 'object') {
			break;
		}

		current = parent;
	}

	return current;
}

function nodeAtPath(schema: JSONSchema | boolean, path: Path): JSONSchema | undefined {
	let current: unknown = schema;

	for (const token of path) {
		if (Array.isArray(current)) {
			const index = typeof token === 'number' ? token : Number(token);

			if (!Number.isInteger(index) || !Object.hasOwn(current, index)) {
				return undefined;
			}

			current = current[index];
			continue;
		}

		if (!isPlainObject(current) || !Object.hasOwn(current, token)) {
			return undefined;
		}

		current = current[token];
	}

	return isPlainObject(current) ? current : undefined;
}

function setField(result: ShapeBuilder, keyword: string, value: unknown): void {
	Object.defineProperty(result, keyword, {
		enumerable: true,
		configurable: true,
		writable: true,
		value,
	});
}
