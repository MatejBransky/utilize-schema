import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { renderType } from './render/dispatch';
import { renderObjectBodyWith } from './render/objectBody';
import type { TypeContext } from './render/context';

export { RENDERED_GLOBAL_TYPES } from './render/constants';
export type { CustomSchemaResolver, InferenceMode, TypeContext } from './render/context';
export { renderJsDoc } from './render/jsdoc';
export { isObjectDeclaration } from './render/objectDeclaration';
export { renderType };

export function renderObjectBody(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	memberLevel: number
): string {
	return renderObjectBodyWith(schema, context, memberLevel, renderType);
}
