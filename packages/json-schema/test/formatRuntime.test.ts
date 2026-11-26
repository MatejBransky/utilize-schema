import { describe, expect, test } from 'vitest';

import { formatBody, formatConstantBase, formatNameFor, formatPattern } from '../src/formatRuntime';

describe('formatPattern', () => {
	test.each(['json-pointer', 'relative-json-pointer'])('returns a pattern for %s', (format) => {
		expect(formatPattern(format)).toMatch(/^\^/);
	});

	test('returns nothing for a structural format', () => {
		expect(formatPattern('email')).toBeUndefined();
	});
});

describe('formatBody', () => {
	test.each([
		['date-time', 'const match = new RegExp('],
		['time', 'const match = new RegExp('],
		['email', 'return isEmail(value, false);'],
		['hostname', 'return isHost(value, false);'],
		['idn-email', 'return isEmail(value, true);'],
		['idn-hostname', 'return isHost(value, true);'],
		['iri', 'return isUri(value, false, true);'],
		['iri-reference', 'return isUri(value, true, true);'],
		['regex', "new RegExp(value, 'u');"],
		['uri', 'return isUri(value, false, false);'],
		['uri-reference', 'return isUri(value, true, false);'],
		['uri-template', 'return isUriTemplate(value);'],
	])('returns source for %s', (format, fragment) => {
		expect(formatBody(format)).toContain(fragment);
	});

	test('returns nothing for a pattern format', () => {
		expect(formatBody('json-pointer')).toBeUndefined();
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
