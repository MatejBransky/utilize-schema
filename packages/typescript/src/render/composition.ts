import type {
	JSONSchemaTypeName,
	ParsedJSONSchema,
	ParsedJSONSchemaObject,
} from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { intersection, union } from './operators';
import { hasRenderableKeywords, remainingSchema, withType } from './schema';

export function renderAllOf(
	allOf: ParsedJSONSchema[],
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const parts = allOf.map((subschema) => render(subschema, context, level));
	const parent = remainingSchema(schema, 'allOf');

	if (hasRenderableKeywords(parent)) {
		parts.unshift(render(parent, context, level));
	}

	return intersection(parts);
}

export function unionKeywordOf(schema: ParsedJSONSchemaObject): 'anyOf' | 'oneOf' | undefined {
	if (Array.isArray(schema.anyOf)) {
		return 'anyOf';
	}

	return Array.isArray(schema.oneOf) ? 'oneOf' : undefined;
}

export function renderTypeArray(
	types: JSONSchemaTypeName[],
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	if (types.length === 0) {
		return 'never';
	}

	return union(types.map((type) => render(withType(schema, type), context, level)));
}

/**
 * A union applicator only describes one branch of the value; sibling keywords
 * still constrain it, so they are intersected with the union.
 */
export function renderUnionApplicator(
	schema: ParsedJSONSchemaObject,
	keyword: 'anyOf' | 'oneOf',
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const members = schema[keyword];

	if (!Array.isArray(members)) {
		throw new Error(`Expected ${keyword} members`);
	}

	const branch = union(members.map((member) => render(member, context, level)));
	const parent = remainingSchema(schema, keyword);

	if (!hasRenderableKeywords(parent)) {
		return branch;
	}

	const parentType = render(parent, context, level);

	return parentType === 'unknown' ? branch : intersection([branch, parentType]);
}
