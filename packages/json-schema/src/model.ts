/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';

import type { DialectId, DialectSource } from './dialect';

export interface JSONSchema extends JSONSchema7 {
	/** draft-04 identifier; `$id` replaced it in draft-06. */
	id?: string;
	/** 2019-09 location-independent identifier. */
	$anchor?: string;
	discriminator?: string;
	/** 2019-09 annotation; draft-07 schemas can carry it too. */
	deprecated?: boolean;
	// 2019-09 and 2020-12 keywords. The normalizer maps or rejects them.
	prefixItems?: JSONSchema[];
	unevaluatedProperties?: boolean | JSONSchema;
	unevaluatedItems?: boolean | JSONSchema;
	$recursiveRef?: string;
	$recursiveAnchor?: boolean;
	$dynamicRef?: string;
	$dynamicAnchor?: string;
	$vocabulary?: Record<string, boolean>;
	minContains?: number;
	maxContains?: number;
}
export type JSONSchemaTypeName = JSONSchema7TypeName;

export const Meta = Symbol('Meta');

/** Original document snapshot and retrieval URI, attached before normalization. */
export const Source = Symbol('Source');
export const SourceCatalog = Symbol('SourceCatalog');

export interface SourceDocument {
	uri: string;
	schema: JSONSchema | boolean;
}

export type SourceCatalog = readonly SourceDocument[];

export interface SchemaKeysType<Schema extends JSONSchema> {
	const?: any;

	enum?: any[];

	// https://www.learnjsonschema.com/draft7/validation/definitions/
	$defs?: Record<string, Schema>;
	definitions?: Record<string, Schema>;

	// https://www.learnjsonschema.com/draft7/validation/properties/
	properties?: Record<string, Schema>;
	// https://www.learnjsonschema.com/draft7/validation/additionalproperties/
	additionalProperties?: boolean | Schema;
	// https://www.learnjsonschema.com/draft7/validation/patternproperties/
	patternProperties?: Record<string, Schema>;
	// https://www.learnjsonschema.com/draft7/validation/propertynames/
	propertyNames?: Schema;

	// https://www.learnjsonschema.com/draft7/validation/items/
	items?: Schema | Schema[];
	// https://json-schema.org/draft/2020-12/applicator#prefixItems
	prefixItems?: Schema[];
	// https://www.learnjsonschema.com/draft7/validation/additionalitems/
	additionalItems?: boolean | Schema;
	// https://www.learnjsonschema.com/draft7/validation/contains/
	contains?: Schema;

	// https://www.learnjsonschema.com/draft7/validation/dependencies/
	dependencies?: Record<string, string[] | Schema>;

	// https://www.learnjsonschema.com/draft7/validation/allof/
	allOf?: Schema[];
	// https://www.learnjsonschema.com/draft7/validation/anyof/
	anyOf?: Schema[];
	// https://www.learnjsonschema.com/draft7/validation/oneof/
	oneOf?: Schema[];

	// https://www.learnjsonschema.com/draft7/validation/not/
	not?: Schema;
}

export type Path = (string | number)[];

export const SchemaKeys: Record<keyof SchemaKeysType<JSONSchema>, string> = {
	const: 'const',

	enum: 'enum',

	$defs: '$defs',
	definitions: 'definitions',

	properties: 'properties',
	additionalProperties: 'additionalProperties',
	propertyNames: 'propertyNames',
	patternProperties: 'patternProperties',

	additionalItems: 'additionalItems',
	items: 'items',
	prefixItems: 'prefixItems',
	contains: 'contains',

	dependencies: 'dependencies',

	allOf: 'allOf',
	anyOf: 'anyOf',
	oneOf: 'oneOf',

	not: 'not',
};

export type Meta = {
	fileName: string;
	filePath: string;
	path: Path;
	parent: ParsedJSONSchema | null;
	reference?: ParsedJSONSchema;
	isCircular?: boolean;
	resolvedName?: string;
	/** Dialect of the schema resource this node belongs to. */
	dialect: DialectId;
	/** Where `dialect` came from: `$schema`, the enclosing resource, or a fallback. */
	dialectSource: DialectSource;
};

export interface ParsedJSONSchemaObject
	extends
		Omit<JSONSchema, keyof SchemaKeysType<JSONSchema>>,
		SchemaKeysType<ParsedJSONSchemaObject> {
	[Meta]: Meta;
}

export type ParsedJSONSchema = ParsedJSONSchemaObject | boolean | null;

/** Structural guard for a schema object; document validation belongs to the parser. */
export function isJSONSchemaObject(value: unknown): value is JSONSchema {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJSONSchema(value: unknown): value is JSONSchema | boolean {
	return typeof value === 'boolean' || isJSONSchemaObject(value);
}

/** A parsed schema object carries the non-enumerable metadata symbol added by the linker. */
export function isParsedJSONSchemaObject(value: unknown): value is ParsedJSONSchemaObject {
	return isJSONSchemaObject(value) && Object.hasOwn(value, Meta);
}

export function isParsedJSONSchema(value: unknown): value is ParsedJSONSchema {
	return value === null || typeof value === 'boolean' || isParsedJSONSchemaObject(value);
}

/**
 * Copies the non-enumerable `Meta` from a source node to a synthetic node.
 * Generators create shallow copies while applying a type or splitting a `$ref`
 * from its siblings; object spread drops `Meta`, and with it the dialect of the
 * resource the copy came from.
 */
export function withSourceMeta<T extends object>(
	source: ParsedJSONSchemaObject,
	value: T
): T & ParsedJSONSchemaObject {
	const meta = source[Meta];

	if (meta === undefined) {
		throw new TypeError('Expected a source schema with metadata');
	}

	defineSourceMeta(value, meta);

	return value;
}

function defineSourceMeta<T extends object>(
	value: T,
	meta: Meta
): asserts value is T & ParsedJSONSchemaObject {
	Object.defineProperty(value, Meta, {
		enumerable: false,
		configurable: true,
		value: meta,
	});
}

/** Attaches the pre-normalization document snapshot to a document root. */
export function withSourceDocument<T extends object>(value: T, source: SourceDocument): T {
	Object.defineProperty(value, Source, {
		enumerable: false,
		configurable: true,
		value: source,
	});

	return value;
}

export function sourceDocumentOf(value: unknown): SourceDocument | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined;
	}

	const source: unknown = Object.getOwnPropertyDescriptor(value, Source)?.value;

	return isSourceDocument(source) ? source : undefined;
}

export function withSourceCatalog<T extends object>(value: T, catalog: SourceCatalog): T {
	Object.defineProperty(value, SourceCatalog, {
		enumerable: false,
		configurable: true,
		value: catalog,
	});

	return value;
}

export function sourceCatalogOf(value: unknown): SourceCatalog | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined;
	}

	const catalog: unknown = Object.getOwnPropertyDescriptor(value, SourceCatalog)?.value;

	return Array.isArray(catalog) && catalog.every(isSourceDocument) ? catalog : undefined;
}

function isSourceDocument(value: unknown): value is SourceDocument {
	return (
		typeof value === 'object' &&
		value !== null &&
		'uri' in value &&
		typeof value.uri === 'string' &&
		'schema' in value &&
		isJSONSchema(value.schema)
	);
}
