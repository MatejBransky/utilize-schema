import { createGenerator } from './createGenerator';
import type { FormatMap, FormatMode } from './types';

import { unicodePattern } from '../regex';
import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => {
		if ('enum' in schema) {
			return false;
		}

		if (schema.type === 'string') {
			return true;
		}

		if (!schema.type && typeof schema.default === 'string') {
			return true;
		}

		return false;
	},
	(schema, context) => {
		const format = schema.format ? resolveFormat(schema.format, context) : undefined;
		let expression: string;

		if (format) {
			expression = format;
		} else {
			expression = ts`z.string()`;
		}

		expression = applyStringConstraints({ expression, schema });

		return expression;
	}
);

/**
 * Picks the expression for a format. An explicit `formatMap` entry always wins;
 * otherwise `assert` uses the built-in mapping and `annotate` leaves the
 * expression as `z.string()` so `format` stays metadata.
 */
function resolveFormat(
	format: string,
	{ formatMap, formatMode }: { formatMap?: FormatMap; formatMode?: FormatMode }
) {
	const mapped = ownValue(formatMap, format);

	if (mapped) {
		return mapped;
	}

	return (formatMode ?? 'assert') === 'assert' ? formatExpression(format) : undefined;
}

function formatExpression(format: string) {
	const method = ownValue(formatToZodMethod, format);

	return method ? ts`z${method}` : undefined;
}

/**
 * Reads a format mapping without falling back to `Object.prototype`, so formats
 * named like `constructor` or `toString` count as unknown.
 */
function ownValue(map: Record<string, string> | undefined, key: string) {
	return map && Object.hasOwn(map, key) ? map[key] : undefined;
}

interface StringConstraints {
	expression: string;
	schema: {
		minLength?: number;
		maxLength?: number;
		pattern?: string;
	};
}

function applyStringConstraints({ expression, schema }: StringConstraints) {
	if (schema.minLength !== undefined) {
		expression += `.min(${schema.minLength})`;
	}

	if (schema.maxLength !== undefined) {
		expression += `.max(${schema.maxLength})`;
	}

	if (schema.pattern) {
		expression += `.regex(${unicodePattern(schema.pattern, 'pattern')})`;
	}

	return expression;
}

export const formatToZodMethod: Record<string, string> = {
	email: '.email()',
	uuid: '.uuid()',
	url: '.url()',
	uri: '.url()',
	emoji: '.emoji()',
	base64: '.base64()',
	base64url: '.base64url()',
	nanoid: '.nanoid()',
	cuid: '.cuid()',
	cuid2: '.cuid2()',
	ulid: '.ulid()',
	ipv4: '.ipv4()',
	ipv6: '.ipv6()',
	cidrv4: '.cidrv4()',
	cidrv6: '.cidrv6()',
	date: '.iso.date()',
	time: '.iso.time()',
	'date-time': '.iso.datetime()',
	duration: '.iso.duration()',
};
