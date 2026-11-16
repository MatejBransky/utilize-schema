import {
	isPlainObject,
	Meta,
	type ParsedJSONSchema,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';

export interface ValueTypeContext {
	/** The value-type alias of a schema in a cycle, when it has one. */
	aliasFor(schema: ParsedJSONSchemaObject): string | undefined;
	/** The exported type alias of a schema outside of a cycle. */
	typeNameFor(schema: ParsedJSONSchemaObject): string;
}

/**
 * Renders the TypeScript type of a schema that takes part in a reference cycle.
 * Effect schemas recurse through `Schema.suspend`, which makes the inferred type
 * of the generated const reference itself and collapse to `any`, so cyclic
 * schemas get an explicit annotation built from this type instead.
 */
export function renderValueTypeDeclaration(
	name: string,
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext
): string {
	const record = renderRecordInterface(schema, context, name);

	if (record !== undefined) {
		return `interface ${name} ${record}`;
	}

	return `type ${name} = ${renderValueType(schema, context, name, false)};`;
}

/**
 * A `type X = Record<string, X>` alias is circular, while an interface index
 * signature defers the reference, so record schemas are emitted as interfaces.
 */
function renderRecordInterface(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string
): string | undefined {
	if (
		schema.$ref !== undefined ||
		Object.hasOwn(schema, 'const') ||
		Array.isArray(schema.enum) ||
		Array.isArray(schema.allOf) ||
		Array.isArray(schema.anyOf) ||
		Array.isArray(schema.oneOf) ||
		Array.isArray(schema.type) ||
		(schema.type !== undefined && schema.type !== 'object')
	) {
		return undefined;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = Array.isArray(schema.required) ? schema.required : [];

	if (Object.keys(properties).length > 0 || required.length > 0) {
		return undefined;
	}

	const additional = schema.additionalProperties;
	const value =
		additional === false
			? 'never'
			: isPlainObject(additional)
				? renderValueType(additional, context, self, true)
				: 'Schema.Json';

	return `{\n\t[key: string]: ${value};\n}`;
}

/**
 * `deferred` marks positions TypeScript resolves lazily (object members, array
 * elements, index signatures), where a recursive alias is allowed. A direct
 * self reference would be circular, so it degrades to `Schema.Json`.
 */
export function renderValueType(
	schema: ParsedJSONSchema,
	context: ValueTypeContext,
	self?: string,
	deferred = true
): string {
	if (schema === undefined || schema === null || schema === true) {
		return 'Schema.Json';
	}

	if (schema === false) {
		return 'never';
	}

	if (!isPlainObject(schema)) {
		return 'Schema.Json';
	}

	if (typeof schema.$ref === 'string') {
		const reference = schema[Meta]?.reference;

		if (reference === undefined) {
			return 'Schema.Json';
		}

		const alias = context.aliasFor(reference);

		if (alias === undefined) {
			return context.typeNameFor(reference);
		}

		return alias === self && !deferred ? 'Schema.Json' : alias;
	}

	if (Object.hasOwn(schema, 'const')) {
		return literalType(schema.const);
	}

	if (Array.isArray(schema.enum)) {
		return union(schema.enum.map(literalType));
	}

	if (Array.isArray(schema.allOf)) {
		return intersection([
			renderValueType(parentSchema(schema), context, self, deferred),
			...schema.allOf.map((subschema) => renderValueType(subschema, context, self, deferred)),
		]);
	}

	const alternatives = Array.isArray(schema.anyOf)
		? schema.anyOf
		: Array.isArray(schema.oneOf)
			? schema.oneOf
			: undefined;

	if (alternatives) {
		return union(alternatives.map((subschema) => renderValueType(subschema, context)));
	}

	if (Array.isArray(schema.type)) {
		return union(schema.type.map((type) => renderValueType(schemaWithType(schema, type), context)));
	}

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
			return renderArray(schema, context, self);
		case 'object':
			return renderObject(schema, context, self);
		default:
			return 'Schema.Json';
	}
}

function renderArray(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined
): string {
	const items = schema.items as unknown as ParsedJSONSchema | ParsedJSONSchema[] | undefined;
	const prefixItems = Array.isArray(schema.prefixItems)
		? (schema.prefixItems as ParsedJSONSchema[])
		: Array.isArray(items)
			? items
			: undefined;

	const singleItem = Array.isArray(items) ? undefined : items;

	if (prefixItems === undefined) {
		const item =
			singleItem === undefined || singleItem === true
				? 'Schema.Json'
				: renderValueType(singleItem, context, self, true);

		return `ReadonlyArray<${item}>`;
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const type = renderValueType(item, context, self, true);

		return index < minItems ? type : `${parenthesize(type)}?`;
	});
	const rest = arrayRest(schema, items);

	if (rest === false) {
		return `readonly [${elements.join(', ')}]`;
	}

	return `readonly [${[...elements, `...${parenthesize(renderValueType(rest, context, self, true))}[]`].join(', ')}]`;
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

function renderObject(
	schema: ParsedJSONSchemaObject,
	context: ValueTypeContext,
	self: string | undefined
): string {
	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = new Set(
		Array.isArray(schema.required)
			? schema.required.filter((key): key is string => typeof key === 'string')
			: []
	);
	const keys = [...new Set([...Object.keys(properties), ...required])];
	const additional = schema.additionalProperties;

	if (keys.length === 0) {
		if (additional === false) {
			return 'Record<string, never>';
		}
		if (isPlainObject(additional)) {
			return `Record<string, ${renderValueType(additional, context, self, true)}>`;
		}

		return 'Record<string, Schema.Json>';
	}

	const members = keys.map((key) => {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		const type =
			property !== undefined
				? renderValueType(property, context, self, true)
				: additional === false
					? 'never'
					: 'Schema.Json';

		return `${propertyKey(key)}${required.has(key) ? '' : '?'}: ${type}`;
	});

	return `{ ${members.join('; ')} }`;
}

/** Mirrors the generator, which merges `allOf` into one object schema. */
function parentSchema(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject {
	return {
		...schema,
		allOf: undefined,
		not: undefined,
		if: undefined,
		then: undefined,
		else: undefined,
	};
}

function schemaWithType(
	schema: ParsedJSONSchemaObject,
	type: ParsedJSONSchemaObject['type']
): ParsedJSONSchemaObject {
	return { ...schema, type };
}

function literalType(value: unknown): string {
	if (value === null) {
		return 'null';
	}
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}

	return 'never';
}

function union(types: string[]): string {
	const unique = [...new Set(types.filter(Boolean))];

	return unique.length > 0 ? unique.join(' | ') : 'never';
}

function intersection(types: string[]): string {
	const unique = [...new Set(types.filter(Boolean))];

	return unique.length > 0 ? unique.map(parenthesize).join(' & ') : 'Schema.Json';
}

function parenthesize(type: string): string {
	return /[|&]/.test(type) && !type.startsWith('{') && !type.startsWith('readonly [')
		? `(${type})`
		: type;
}

function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
