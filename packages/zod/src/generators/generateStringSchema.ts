import type { ExpressionGenerator, StringMatch } from './types';

import { ts } from '../utils';

export const generateStringSchema: ExpressionGenerator<StringMatch> = (
	schema
) => {
	const format = schema.format && formatToZodMethod[schema.format];
	let expression: string;

	if (format) {
		expression = ts`z.${format}`;
	} else {
		expression = ts`z.string()`;
	}

	expression = applyStringConstraints({ expression, schema });

	return expression;
};

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
		expression += `.regex(${new RegExp(schema.pattern)})`;
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
