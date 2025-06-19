import type {
	JSONSchema7,
	JSONSchema7Type,
	JSONSchema7TypeName,
} from 'json-schema';
import moize from 'moize';

import { isPlainObject } from '../utils';

export const SchemaType = {
	ALL_OF: 'ALL_OF',
	UNNAMED_SCHEMA: 'UNNAMED_SCHEMA',
	ANY: 'ANY',
	ANY_OF: 'ANY_OF',
	BOOLEAN: 'BOOLEAN',
	// NAMED_ENUM: 'NAMED_ENUM',
	NAMED_SCHEMA: 'NAMED_SCHEMA',
	// NEVER: 'NEVER',
	NULL: 'NULL',
	NUMBER: 'NUMBER',
	INTEGER: 'INTEGER',
	STRING: 'STRING',
	OBJECT: 'OBJECT',
	ONE_OF: 'ONE_OF',
	TYPED_ARRAY: 'TYPED_ARRAY',
	REFERENCE: 'REFERENCE',
	UNION: 'UNION',
	UNNAMED_ENUM: 'UNNAMED_ENUM',
	UNTYPED_ARRAY: 'UNTYPED_ARRAY',
	CONST: 'CONST',
} as const;
export type SchemaType = (typeof SchemaType)[keyof typeof SchemaType];

export interface JSONSchema extends JSONSchema7 {
	/**
	 * A reference to the original schema, if this is a reference schema.
	 */
	[Reference]?: { ref: string; schema: JSONSchema; name: string };

	discriminator?: string;
}
export type JSONSchemaType = JSONSchema7Type;
export type JSONSchemaTypeName = JSONSchema7TypeName;

export const Parent = Symbol('Parent');
export const Types = Symbol('Types');
export const Intersection = Symbol('Intersection');
export const Reference = Symbol('Reference');

export interface LinkedJSONSchema extends JSONSchema {
	/**
	 * A reference to this schema's parent node, for convenience.
	 * `null` when this is the root schema.
	 */
	[Parent]: LinkedJSONSchema | null;
	/**
	 * A reference to the original schema, if this is a reference schema.
	 */
	[Reference]?: { ref: string; schema: LinkedJSONSchema; name: string };

	additionalItems?: boolean | LinkedJSONSchema;
	additionalProperties?: boolean | LinkedJSONSchema;
	items?: LinkedJSONSchema | LinkedJSONSchema[];
	definitions?: {
		[k: string]: LinkedJSONSchema;
	};
	$defs?: {
		[k: string]: LinkedJSONSchema;
	};
	properties?: {
		[k: string]: LinkedJSONSchema;
	};
	patternProperties?: {
		[k: string]: LinkedJSONSchema;
	};
	dependencies?: {
		[k: string]: LinkedJSONSchema | string[];
	};
	allOf?: LinkedJSONSchema[];
	anyOf?: LinkedJSONSchema[];
	oneOf?: LinkedJSONSchema[];
	not?: LinkedJSONSchema;
}

/**
 * Normalized JSON schema.
 *
 * Note: `definitions` and `id` are removed by the normalizer. Use `$defs` and `$id` instead.
 */
export interface NormalizedJSONSchema
	extends Omit<LinkedJSONSchema, 'definitions' | 'id'> {
	/**
	 * Stores the intersection schema if this schema
	 * is the result of an allOf combination
	 */
	[Intersection]?: NormalizedJSONSchema;
	[Parent]: NormalizedJSONSchema | null;
	/**
	 * Set of all schema types (SchemaType) that
	 * this schema represents, precomputed for efficiency
	 */
	[Types]: ReadonlySet<SchemaType>;

	additionalItems?: boolean | NormalizedJSONSchema;
	additionalProperties: boolean | NormalizedJSONSchema;
	extends?: string[];
	items?: NormalizedJSONSchema | NormalizedJSONSchema[];
	$defs?: {
		[k: string]: NormalizedJSONSchema;
	};
	properties?: {
		[k: string]: NormalizedJSONSchema;
	};
	patternProperties?: {
		[k: string]: NormalizedJSONSchema;
	};
	dependencies?: {
		[k: string]: NormalizedJSONSchema | string[];
	};
	allOf?: NormalizedJSONSchema[];
	anyOf?: NormalizedJSONSchema[];
	oneOf?: NormalizedJSONSchema[];
	not?: NormalizedJSONSchema;
	required: string[];
}

export function isCompound(schema: JSONSchema): boolean {
	return Array.isArray(schema.type) || 'anyOf' in schema || 'oneOf' in schema;
}

export const getRootSchema = moize(
	(schema: LinkedJSONSchema): LinkedJSONSchema => {
		const parent = schema[Parent];
		if (!parent) return schema;

		return getRootSchema(parent);
	}
) as (schema: LinkedJSONSchema) => LinkedJSONSchema;

export function isBoolean(
	schema: LinkedJSONSchema | JSONSchemaType
): schema is boolean {
	return schema === true || schema === false;
}

export function isPrimitive(
	schema: LinkedJSONSchema | JSONSchemaType
): schema is JSONSchemaType {
	return !isPlainObject(schema);
}
