import type { JSONSchema7, JSONSchema7Type } from 'json-schema';

export type JSONSchema = JSONSchema7;
export type JSONSchemaType = JSONSchema7Type;

export const Parent = Symbol('Parent');

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
