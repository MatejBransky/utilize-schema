import { expectDefined } from '@utilize/json-schema';
import type { Dialect, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { Recursion } from './createGenerator';
import type { GeneratorContext } from './types';

import { NEWLINE, ts } from '../utils';

export const tupleGenerator = createGenerator(
	(schema, dialect) => {
		if (schema.type !== 'array') {
			return false;
		}

		return tupleItems(schema, dialect) !== undefined;
	},
	(schema, context, { generateSchema }) => {
		const items = expectDefined(tupleItems(schema, context.dialect));
		const minItems = schema.minItems ?? 0;
		const rest = tupleRest(schema, context.dialect);
		// The tuple's own maximum is `items.length` when there is no rest schema.
		const noRest =
			rest === false || (schema.maxItems !== undefined && schema.maxItems === items.length);
		const itemsPart = renderTupleItems(items, minItems, context, generateSchema);
		const restPart = renderTupleRest(rest, noRest, context, generateSchema);
		let expression = ts`z.tuple([
    ${itemsPart.join(`,${NEWLINE}`)}
  ])${restPart}`;
		const checks = tupleLengthChecks(schema, items, noRest, minItems);

		if (checks.length > 0) {
			expression = ts`${expression}.refine((value) => ${checks.join(' && ')}, { message: 'Array length is out of bounds.' })`;
		}

		return expression;
	}
);

function renderTupleItems(
	items: ParsedJSONSchemaObject[],
	minItems: number,
	context: GeneratorContext,
	generateSchema: Recursion['generateSchema']
): string[] {
	// An item is required when the minimum length reaches it; the rest stay
	// optional, which keeps `z.infer` precise for fixed-length tuples.
	return items.map((item, index) =>
		index < minItems
			? generateSchema(item, context)
			: ts`${generateSchema(item, context)}.optional()`
	);
}

function renderTupleRest(
	rest: ParsedJSONSchema | boolean | undefined,
	noRest: boolean,
	context: GeneratorContext,
	generateSchema: Recursion['generateSchema']
): string {
	if (noRest) {
		return '';
	}

	return ts`.rest(${rest === undefined || rest === true ? ts`z.unknown()` : generateSchema(rest, context)})`;
}

function tupleLengthChecks(
	schema: ParsedJSONSchemaObject,
	items: ParsedJSONSchemaObject[],
	noRest: boolean,
	minItems: number
): string[] {
	const checks: string[] = [];

	// Required items already enforce a minimum up to `items.length`.
	if (minItems > items.length) {
		checks.push(`value.length >= ${minItems}`);
	}
	// Without a rest schema the tuple itself caps the length at `items.length`.
	if (schema.maxItems !== undefined && (noRest ? schema.maxItems < items.length : true)) {
		checks.push(`value.length <= ${schema.maxItems}`);
	}

	return checks;
}

export function tupleItems(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): ParsedJSONSchemaObject[] | undefined {
	if (dialect.tuple === 'prefixItems') {
		if (Array.isArray(schema.prefixItems)) {
			return schema.prefixItems;
		}

		// The tuple form of `items` was removed in 2020-12. With a lenient
		// keyword policy it is ignored instead of generated.
		return undefined;
	}

	return Array.isArray(schema.items) ? schema.items : undefined;
}

export function tupleRest(
	schema: ParsedJSONSchemaObject,
	dialect: Dialect
): ParsedJSONSchemaObject | boolean | undefined {
	if (dialect.tuple === 'prefixItems') {
		if (Array.isArray(schema.prefixItems)) {
			return Array.isArray(schema.items) ? undefined : schema.items;
		}

		return undefined;
	}

	return schema.additionalItems;
}
