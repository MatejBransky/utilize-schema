import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { generateSchema } from './generateSchema';

import { NEWLINE, ts } from '../utils';

export const generator = createGenerator(
	(schema) => {
		if (schema.type !== 'array') {
			return false;
		}

		return tupleItems(schema) !== undefined;
	},
	(schema, context) => {
		const items = tupleItems(schema)!;
		const minItems = schema.minItems ?? 0;
		const rest = tupleRest(schema);
		// The tuple's own maximum is `items.length` when there is no rest schema.
		const noRest =
			rest === false || (schema.maxItems !== undefined && schema.maxItems === items.length);

		// An item is required when the minimum length reaches it; the rest stay
		// optional, which keeps `z.infer` precise for fixed-length tuples.
		const itemsPart = items.map((item, index) =>
			index < minItems
				? generateSchema(item, context)
				: ts`${generateSchema(item, context)}.optional()`
		);
		const restPart = noRest
			? ''
			: ts`.rest(${rest === undefined || rest === true ? ts`z.unknown()` : generateSchema(rest, context)})`;
		let expression = ts`z.tuple([
    ${itemsPart.join(`,${NEWLINE}`)}
  ])${restPart}`;
		const checks: string[] = [];

		// Required items already enforce a minimum up to `items.length`.
		if (minItems > items.length) {
			checks.push(`value.length >= ${minItems}`);
		}
		// Without a rest schema the tuple itself caps the length at `items.length`.
		if (schema.maxItems !== undefined && (noRest ? schema.maxItems < items.length : true)) {
			checks.push(`value.length <= ${schema.maxItems}`);
		}
		if (checks.length > 0) {
			expression = ts`${expression}.refine((value) => ${checks.join(' && ')}, { message: 'Array length is out of bounds.' })`;
		}

		return expression;
	}
);

export function tupleItems(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject[] | undefined {
	if (Array.isArray(schema.prefixItems)) {
		return schema.prefixItems;
	}

	if (Array.isArray(schema.items)) {
		return schema.items;
	}

	return undefined;
}

export function tupleRest(
	schema: ParsedJSONSchemaObject
): ParsedJSONSchemaObject | boolean | undefined {
	if (Array.isArray(schema.prefixItems)) {
		return Array.isArray(schema.items) ? undefined : schema.items;
	}

	return schema.additionalItems;
}
