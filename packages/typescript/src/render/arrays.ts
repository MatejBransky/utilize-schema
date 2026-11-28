import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { parenthesize } from './operators';

export function renderArray(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const items = schema.items;
	const prefixItems = Array.isArray(schema.prefixItems)
		? schema.prefixItems
		: Array.isArray(items)
			? items
			: undefined;

	if (prefixItems === undefined) {
		const item = Array.isArray(items) ? undefined : items;

		return arrayOf(render(item ?? true, context, level));
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const type = render(item, context, level);

		return index < minItems ? type : `${parenthesize(type)}?`;
	});
	const rest = arrayRest(schema, items);

	if (rest === false) {
		return `[${elements.join(', ')}]`;
	}

	const restType = render(rest, context, level);

	return `[${[...elements, `...${arrayOf(restType)}`].join(', ')}]`;
}

function arrayOf(type: string): string {
	return `Array<${type}>`;
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

	return schema.additionalItems ?? true;
}
