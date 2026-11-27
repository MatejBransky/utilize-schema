import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { indent } from './constants';
import type { RenderNested, TypeContext } from './context';
import { renderObjectBodyWith } from './objectBody';

export function renderObject(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const body = renderObjectBodyWith(schema, context, level + 1, render);

	return `{\n${body}\n${indent(level)}}`;
}
