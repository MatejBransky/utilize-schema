/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';

export interface JSONSchema extends JSONSchema7 {
	discriminator?: string;
}
export type JSONSchemaTypeName = JSONSchema7TypeName;

export const Meta = Symbol('Meta');

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
	// https://www.learnjsonschema.com/draft7/validation/additionalitems/
	additionalItems?: boolean | Schema;
	// https://www.learnjsonschema.com/draft7/validation/contains/
	contains?: Schema;

	// https://www.learnjsonschema.com/draft7/validation/dependencies/
	dependencies?: Record<string, Array<string> | Schema>;

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
	contains: 'contains',

	dependencies: 'dependencies',

	allOf: 'allOf',
	anyOf: 'anyOf',
	oneOf: 'oneOf',

	not: 'not',
};

export type Meta = {
	fileName: string;
	path: Path;
	parent: ParsedJSONSchema | null;
	reference?: ParsedJSONSchemaObject;
	isCircular?: boolean;
	resolvedName?: string;
};

export interface ParsedJSONSchemaObject
	extends Omit<JSONSchema, keyof SchemaKeysType<JSONSchema>>,
		SchemaKeysType<ParsedJSONSchemaObject> {
	[Meta]: Meta;
}

export type ParsedJSONSchema = ParsedJSONSchemaObject | boolean | null;
