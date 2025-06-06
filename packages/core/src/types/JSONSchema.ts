import type { JSONSchema7, JSONSchema7Type } from 'json-schema';

type SchemaType =
	| 'ALL_OF'
	| 'UNNAMED_SCHEMA'
	| 'ANY'
	| 'ANY_OF'
	| 'BOOLEAN'
	| 'NAMED_ENUM'
	| 'NAMED_SCHEMA'
	| 'NEVER'
	| 'NULL'
	| 'NUMBER'
	| 'STRING'
	| 'OBJECT'
	| 'ONE_OF'
	| 'TYPED_ARRAY'
	| 'REFERENCE'
	| 'UNION'
	| 'UNNAMED_ENUM'
	| 'UNTYPED_ARRAY'
	| 'CUSTOM_TYPE';

export type JSONSchema = JSONSchema7;
export type JSONSchemaType = JSONSchema7Type;

export const Parent = Symbol('Parent');
export const Types = Symbol('Types');
export const Intersection = Symbol('Intersection');

export interface LinkedJSONSchema extends JSONSchema {
	/**
	 * A reference to this schema's parent node, for convenience.
	 * `null` when this is the root schema.
	 */
	[Parent]: LinkedJSONSchema | null;

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
