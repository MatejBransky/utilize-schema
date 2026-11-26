import { describe, expect, test } from 'vitest';

import { formatBody, formatConstantBase, formatNameFor, formatPattern } from '../src/formatRuntime';

describe('formatPattern', () => {
	test.each(['time', 'json-pointer', 'relative-json-pointer'])(
		'returns a pattern for %s',
		(format) => {
			expect(formatPattern(format)).toMatch(/^\^/);
		}
	);

	test('returns nothing for a structural format', () => {
		expect(formatPattern('email')).toBeUndefined();
	});
});

describe('formatBody', () => {
	test.each([
		'date-time',
		'email',
		'hostname',
		'idn-email',
		'idn-hostname',
		'iri',
		'iri-reference',
		'regex',
		'uri',
		'uri-reference',
		'uri-template',
	])('returns source for %s', (format) => {
		expect(formatBody(format)).toMatch(/\breturn\b/);
	});

	test('returns nothing for a pattern format', () => {
		expect(formatBody('time')).toBeUndefined();
	});
});

describe('format names', () => {
	test('turns a format into a constant name', () => {
		expect(formatConstantBase('date-time')).toBe('formatDateTime');
	});

	test('allocates once and reuses the name', () => {
		const formatNames = new Map<string, string>();
		const usedNames = new Set(['formatEmail']);

		expect(formatNameFor('email', formatNames, usedNames)).toBe('formatEmail1');
		expect(formatNameFor('email', formatNames, usedNames)).toBe('formatEmail1');
	});
});
