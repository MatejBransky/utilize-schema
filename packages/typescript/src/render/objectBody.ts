import { isPlainObject } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { indent } from './constants';
import type { RenderNested, TypeContext } from './context';
import { indexSignatureType } from './indexSignature';
import { renderJsDoc } from './jsdoc';
import { declaredKeys, requiredKeys } from './objectKeys';
import { implicitPropertyType } from './patternProperties';
import { propertyKey } from './text';

/**
 * Renders an object body; the index signature widens `additionalProperties` with
 * the patterns and declared property types so every member stays assignable.
 */
export function renderObjectBodyWith(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	memberLevel: number,
	render: RenderNested
): string {
	const keys = declaredKeys(schema);

	if (keys.length === 0) {
		const index = indexSignatureType(schema, context, [], false, memberLevel, render);

		return `${indent(memberLevel)}[key: string]: ${index ?? 'never'};`;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	const required = requiredKeys(schema);
	const lines: string[] = [];
	const propertyTypes: string[] = [];
	let hasOptional = false;

	for (const key of keys) {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		const optional = !required.has(key);
		const type =
			property !== undefined
				? render(property, context, memberLevel)
				: implicitPropertyType(schema, key, context, memberLevel, render);

		hasOptional ||= optional;
		propertyTypes.push(type);
		lines.push(
			...renderJsDoc(property, memberLevel),
			`${indent(memberLevel)}${readonlyModifier(property)}${propertyKey(key)}${optional ? '?' : ''}: ${type};`
		);
	}

	const index = indexSignatureType(
		schema,
		context,
		propertyTypes,
		hasOptional,
		memberLevel,
		render
	);

	if (index !== undefined) {
		lines.push(`${indent(memberLevel)}[key: string]: ${index};`);
	}

	return lines.join('\n');
}

function readonlyModifier(schema: ParsedJSONSchema | undefined): string {
	return isPlainObject(schema) && schema.readOnly === true ? 'readonly ' : '';
}
