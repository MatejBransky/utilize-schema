import type { ParsedJSONSchemaObject } from '@utilize/json-schema';
import { hasFormatValidator } from '@utilize/json-schema';

import type { Context } from './context';
import { patternExpression } from './expressions';
import { formatCheck } from './formats';

export function generateString(schema: ParsedJSONSchemaObject, context: Context): string {
	const checks = stringChecks(schema);
	const format = stringFormat(schema, context);

	if (format !== undefined) {
		checks.push(format);
	}

	return checks.length > 0 ? `Schema.String.check(${checks.join(', ')})` : 'Schema.String';
}

function stringChecks(schema: ParsedJSONSchemaObject): string[] {
	const checks: string[] = [];

	if (typeof schema.minLength === 'number') {
		checks.push(`Schema.isMinCodePoints(${schema.minLength})`);
	}
	if (typeof schema.maxLength === 'number') {
		checks.push(`Schema.isMaxCodePoints(${schema.maxLength})`);
	}
	if (typeof schema.pattern === 'string') {
		checks.push(`Schema.isPattern(${patternExpression(schema.pattern)})`);
	}

	return checks;
}

function stringFormat(schema: ParsedJSONSchemaObject, context: Context): string | undefined {
	if ((context.formatMode ?? 'assert') !== 'assert' || typeof schema.format !== 'string') {
		return undefined;
	}

	const validationFormat =
		schema.format === 'hostname' &&
		(context.dialect.id === 'draft-04' || context.dialect.id === 'draft-06')
			? 'hostname-legacy'
			: schema.format;

	if (hasFormatValidator(validationFormat)) {
		const validator = context.formatOf(validationFormat);

		return `Schema.makeFilter<string>((value) => ${validator}(value) ? undefined : ${JSON.stringify(`Invalid ${schema.format}`)})`;
	}

	return formatCheck(validationFormat);
}
