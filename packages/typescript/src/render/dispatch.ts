import { isPlainObject, schemaRecord } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { renderArray } from './arrays';
import { renderAllOf, renderTypeArray, renderUnionApplicator, unionKeywordOf } from './composition';
import type { TypeContext } from './context';
import { inferFamily } from './keywords';
import { renderObject } from './objects';
import { renderSpecialSchema } from './special';

export function renderType(
	schema: ParsedJSONSchema | undefined,
	context: TypeContext,
	level = 0
): string {
	const prepared = prepareSchemaInput(schema);

	if (typeof prepared === 'string') {
		return prepared;
	}

	const special = renderSpecialSchema(prepared, context, level, renderType);

	if (special !== undefined) {
		return special;
	}

	if (Array.isArray(prepared.allOf) && prepared.allOf.length > 0) {
		return renderAllOf(prepared.allOf, prepared, context, level, renderType);
	}

	const unionKeyword = unionKeywordOf(prepared);

	if (unionKeyword !== undefined) {
		return renderUnionApplicator(prepared, unionKeyword, context, level, renderType);
	}

	if (Array.isArray(prepared.type)) {
		return renderTypeArray(prepared.type, prepared, context, level, renderType);
	}

	return renderTyped(prepared, context, level);
}

function prepareSchemaInput(
	schema: ParsedJSONSchema | undefined
): ParsedJSONSchemaObject | 'unknown' | 'never' {
	if (schema === undefined || schema === null || schema === true) {
		return 'unknown';
	}

	if (schema === false) {
		return 'never';
	}

	return isPlainObject(schema) ? schema : 'unknown';
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
			return renderArray(schema, context, level, renderType);
		case 'object':
			return renderObject(schema, context, level, renderType);
		default:
			return renderUntyped(schema, context, level);
	}
}

function renderUntyped(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number
): string {
	switch (inferFamily(schemaRecord(schema), context.inference)) {
		case 'object':
			return renderObject(schema, context, level, renderType);
		case 'array':
			return renderArray(schema, context, level, renderType);
		case 'string':
			return 'string';
		case 'number':
			return 'number';
		default:
			return 'unknown';
	}
}
