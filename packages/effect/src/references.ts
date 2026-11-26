import { Meta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { Context } from './context';
import { UnresolvedReferenceError } from './errors';
import { applyChecks, siblingKeywordsCheck } from './expressions';
import { generateObject } from './object';
import { planReferenceSiblings } from './refSiblings';

/**
 * A `$ref` with the keywords next to it (see `planReferenceSiblings`) and the
 * node's filter checks (`not`, `if`, ...).
 */
export function generateReference(
	schema: ParsedJSONSchemaObject,
	filters: string[],
	context: Context
): string {
	const siblings = planReferenceSiblings(schema, context.dialect, context.isCyclic);

	switch (siblings.kind) {
		case 'none':
			return checkedReference(schema, filters, context);
		case 'merge':
			return applyChecks(
				siblings.merged === false ? 'Schema.Never' : generateObject(siblings.merged, context),
				filters
			);
		case 'check': {
			const constraints = context.generateSchema(siblings.constraints, context);

			return checkedReference(
				schema,
				[siblingKeywordsCheck(constraints, '$ref'), ...filters],
				context
			);
		}
	}
}

/**
 * Effect cannot attach checks to `Schema.suspend`, so a checked reference is
 * wrapped in a single-member union. The union keeps the reference's type and
 * its declaration stays shared, which also works for recursive schemas.
 */
function checkedReference(
	schema: ParsedJSONSchemaObject,
	checks: string[],
	context: Context
): string {
	const expression = reference(schema, context);

	return checks.length === 0 ? expression : applyChecks(`Schema.Union([${expression}])`, checks);
}

function reference(schema: ParsedJSONSchemaObject, context: Context): string {
	const ref = schema.$ref ?? '#';
	const resolved = schema[Meta]?.reference;

	if (resolved === undefined || resolved === null) {
		throw new UnresolvedReferenceError(ref);
	}

	if (typeof resolved === 'boolean') {
		return resolved ? 'Schema.Json' : 'Schema.Never';
	}

	return `Schema.suspend(() => ${context.nameOf(resolved, ref)})`;
}
