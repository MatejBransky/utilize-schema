import { containsBounds, isKeywordApplicable } from '@utilize/json-schema';
import type { ContainsBounds, ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { Context } from './context';
import { applyChecks } from './expressions';
import { arrayRest, itemsOf, prefixItemsOf } from './schemaParts';

export function generateArray(schema: ParsedJSONSchemaObject, context: Context): string {
	const dialect = context.dialect;
	const items = itemsOf(schema);
	const prefixItems = prefixItemsOf(schema, dialect);
	const checks = arrayChecks(schema, context);
	const singleItem = Array.isArray(items) ? undefined : items;

	if (prefixItems === undefined) {
		const item =
			singleItem === undefined || singleItem === true
				? 'Schema.Json'
				: context.generateSchema(singleItem, context);

		return applyChecks(`Schema.Array(${item})`, checks);
	}

	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
	const elements = prefixItems.map((item, index) => {
		const expression = context.generateSchema(item, context);

		return index < minItems ? expression : `Schema.optionalKey(${expression})`;
	});
	const rest = arrayRest(schema, items, dialect);

	if (rest === false) {
		return applyChecks(`Schema.Tuple([${elements.join(', ')}])`, checks);
	}

	if (elements.length === 0) {
		return applyChecks(`Schema.Array(${context.generateSchema(rest, context)})`, checks);
	}

	return applyChecks(
		`Schema.TupleWithRest(Schema.Tuple([${elements.join(', ')}]), [${context.generateSchema(rest, context)}])`,
		checks
	);
}

function arrayChecks(schema: ParsedJSONSchemaObject, context: Context): string[] {
	const checks: string[] = [];
	const dialect = context.dialect;
	const prefixLength = prefixItemsOf(schema, dialect)?.length ?? 0;
	const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;

	if (minItems > prefixLength) {
		checks.push(`Schema.isMinLength(${minItems})`);
	}
	if (typeof schema.maxItems === 'number') {
		checks.push(`Schema.isMaxLength(${schema.maxItems})`);
	}
	if (schema.uniqueItems === true) {
		checks.push('Schema.isUnique()');
	}

	const contains = containsCheck(schema, context);

	if (contains !== undefined) {
		checks.push(contains);
	}

	return checks;
}

function containsCheck(schema: ParsedJSONSchemaObject, context: Context): string | undefined {
	if (schema.contains === undefined) {
		return undefined;
	}

	if (!isKeywordApplicable(context.dialect, 'contains')) {
		return undefined;
	}

	const contains = context.generateSchema(schema.contains, context);
	const bounds = containsBounds(schema, context.dialect);

	if (bounds === undefined) {
		return undefined;
	}

	return bounds.counted
		? countedContainsCheck(contains, bounds)
		: `Schema.makeFilter((value) => value.some((item) => Schema.is(${contains})(item)) ? undefined : 'Array does not contain a matching item')`;
}

function countedContainsCheck(contains: string, bounds: ContainsBounds): string {
	const outOfRange =
		bounds.max === undefined
			? `matches < ${bounds.min}`
			: `matches < ${bounds.min} || matches > ${bounds.max}`;

	return `Schema.makeFilter((value) => { const matches = value.filter((item) => Schema.is(${contains})(item)).length; return ${outOfRange} ? 'Array does not contain the required number of matching items' : undefined; })`;
}
