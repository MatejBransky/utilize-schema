import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { intersection, union } from './operators';
import {
	hasOnlyTypeKeyword,
	hasRenderableKeywords,
	isOfType,
	isScalarType,
	remainingSchema,
} from './schema';
import { propertyKey, stringLiteral } from './text';

/** Literal constraints intersect with siblings; scalar types filter other JSON types. */
export function renderLiteralConstraint(
	values: unknown[],
	keyword: 'const' | 'enum',
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const parent = remainingSchema(schema, keyword);
	const declaredType = parent.type;

	if (isScalarType(declaredType) && hasOnlyTypeKeyword(parent)) {
		const matching = values.filter((value) => isOfType(value, declaredType));

		return union(matching.map(renderLiteral));
	}

	const literal = union(values.map(renderLiteral));

	if (!hasRenderableKeywords(parent)) {
		return literal;
	}

	const parentType = render(parent, context, level);

	return parentType === 'unknown' ? literal : intersection([literal, parentType]);
}

function renderLiteral(value: unknown): string {
	if (value === null) {
		return 'null';
	}

	if (typeof value === 'string') {
		return stringLiteral(value);
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(renderLiteral).join(', ')}]`;
	}

	if (isPlainObject(value)) {
		const entries = Object.entries(value);

		if (entries.length === 0) {
			return 'Record<string, never>';
		}

		return `{ ${entries
			.map(([key, entry]) => `${propertyKey(key)}: ${renderLiteral(entry)}`)
			.join('; ')} }`;
	}

	return 'unknown';
}
