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
		const itemsPart = tupleItems(schema)!.map(
			(item) => ts`${generateSchema(item, context)}.optional()`
		);
		const rest = tupleRest(schema);
		const restPart =
			rest === false
				? ''
				: ts`.rest(${rest === undefined || rest === true ? ts`z.unknown()` : generateSchema(rest, context)})`;
		let expression = ts`z.tuple([
    ${itemsPart.join(`,${NEWLINE}`)}
  ])${restPart}`;
		const checks: string[] = [];

		if (schema.minItems !== undefined) {
			checks.push(`value.length >= ${schema.minItems}`);
		}
		if (schema.maxItems !== undefined) {
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
