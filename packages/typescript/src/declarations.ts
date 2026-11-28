import type { BooleanDefinition } from './collectStandaloneSchemas';
import type { TypeContext } from './render/context';
import { isObjectDeclaration, renderJsDoc, renderObjectBody, renderType } from './renderType';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

export function renderDeclaration(
	name: string,
	schema: ParsedJSONSchemaObject,
	context: TypeContext
): string {
	const doc = renderJsDoc(schema, 0, name);
	const customType = context.customSchemaResolver?.(schema);

	if (customType !== undefined) {
		return [...doc, `export type ${name} = ${customType};`].join('\n');
	}

	const body = isObjectDeclaration(schema, context.inference)
		? renderObjectBody(schema, context, 1)
		: undefined;

	return body === undefined
		? [...doc, `export type ${name} = ${renderType(schema, context)};`].join('\n')
		: [...doc, `export interface ${name} {\n${body}\n}`].join('\n');
}

export function renderBooleanDeclaration(
	name: string,
	definition: BooleanDefinition,
	context: TypeContext
): string {
	return `export type ${name} = ${renderType(definition.schema, context)};`;
}
