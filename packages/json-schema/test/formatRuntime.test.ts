import { describe, expect, test } from 'vitest';

import {
	formats,
	formatDateTime,
	formatDuration,
	formatEmail,
	formatHostname,
	formatHostnameLegacy,
	formatIdnEmail,
	formatIdnHostname,
	formatIri,
	formatIriReference,
	formatRegex,
	formatTime,
	formatUri,
	formatUriReference,
	formatUriTemplate,
} from '../src/formats';
import {
	formatConstantBase,
	formatNameFor,
	formatPattern,
	hasFormatValidator,
} from '../src/formatRuntime';

describe('formatPattern', () => {
	test.each(['json-pointer', 'relative-json-pointer', 'uuid'])(
		'returns a pattern for %s',
		(format) => {
			expect(formatPattern(format)).toMatch(/^\^/);
		}
	);

	test('returns nothing for a structural format', () => {
		expect(formatPattern('email')).toBeUndefined();
	});
});

describe('hasFormatValidator', () => {
	test.each(Object.keys(formats))('returns true for %s', (format) => {
		expect(hasFormatValidator(format)).toBe(true);
	});

	test('returns false for a pattern format', () => {
		expect(hasFormatValidator('json-pointer')).toBe(false);
	});

	test('does not treat inherited object keys as formats', () => {
		expect(hasFormatValidator('constructor')).toBe(false);
	});
});

describe('formats', () => {
	test('exports one validator per structural format', () => {
		for (const [format, validator] of Object.entries(formats)) {
			expect(validator.name, format).toBe(formatConstantBase(format));
		}
	});

	test('validates an email', () => {
		expect(formatEmail('user@example.com')).toBe(true);
		expect(formatEmail('not-an-email')).toBe(false);
	});

	test('validates a uri', () => {
		expect(formatUri('https://example.com/a?b=1')).toBe(true);
		expect(formatUri('not a uri')).toBe(false);
	});
});

describe('structural validators', () => {
	test('date-time and time', () => {
		expect(formatDateTime('2024-02-29T12:00:00Z')).toBe(true);
		expect(formatDateTime('1998-12-31T15:59:60.123-08:00')).toBe(true);
		expect(formatDateTime('2024-02-29 12:00:00')).toBe(false);
		expect(formatDateTime('1998-12-31T22:59:60Z')).toBe(false);
		expect(formatDateTime('2023-02-29T12:00:00Z')).toBe(false);

		expect(formatTime('12:00:00Z')).toBe(true);
		expect(formatTime('15:59:60-08:00')).toBe(true);
		expect(formatTime('12:00:00')).toBe(false);
		expect(formatTime('23:59:60+01:00')).toBe(false);
	});

	test('duration', () => {
		expect(formatDuration('P3DT4H')).toBe(true);
		expect(formatDuration('P4DT12H30M5S')).toBe(true);
		expect(formatDuration('P2W')).toBe(true);
		expect(formatDuration('P1Y2D')).toBe(false);
		expect(formatDuration('PT0.5S')).toBe(false);
		expect(formatDuration('P')).toBe(false);
		expect(formatDuration('PT3H5S')).toBe(false);
	});

	test('email', () => {
		expect(formatEmail('user@example.com')).toBe(true);
		expect(formatEmail('"joe bloggs"@example.com')).toBe(true);
		expect(formatEmail('user@[127.0.0.1]')).toBe(true);
		expect(formatEmail('user@[IPv6:::1]')).toBe(true);
		expect(formatEmail('te..st@example.com')).toBe(false);
		expect(formatEmail('user@[999.1.1.1]')).toBe(false);
		expect(formatEmail('uživatel@example.com')).toBe(false);
		expect(formatEmail('user@')).toBe(false);
		expect(formatEmail(`${'a'.repeat(65)}@example.com`)).toBe(false);
		expect(formatEmail('"joe"example.com')).toBe(false);
		expect(formatEmail(String.raw`"joe\" bloggs"@example.com`)).toBe(true);
		expect(formatEmail('"joe\\\u0000"@example.com')).toBe(false);
		expect(formatEmail('.user@example.com')).toBe(false);

		expect(formatIdnEmail('실례@실례.테스트')).toBe(true);
		expect(formatIdnEmail('δοκιμή@-example.com')).toBe(false);
	});

	test('hostname', () => {
		expect(formatHostname('example.com')).toBe(true);
		expect(formatHostname('xn--9n2bp8q.xn--9t4b11yi5a')).toBe(true);
		expect(formatHostname('ab--cd.example')).toBe(false);
		expect(formatHostname('-hostname')).toBe(false);
		expect(formatHostname('example.com.')).toBe(false);
		expect(formatHostname('xn--')).toBe(false);

		expect(formatHostnameLegacy('ab--cd.example')).toBe(true);
		expect(formatHostnameLegacy('-hostname')).toBe(false);

		expect(formatIdnHostname('a。b')).toBe(true);
		expect(formatIdnHostname('실례.테스트')).toBe(true);
		expect(formatIdnHostname('مثال.إختبار')).toBe(true);
		expect(formatIdnHostname('עברית.example')).toBe(true);
		expect(formatIdnHostname('a·l')).toBe(false);
		expect(formatIdnHostname('')).toBe(false);
		expect(formatIdnHostname('a b')).toBe(false);
	});

	test('uri and its reference variants', () => {
		expect(formatUri('mailto:John.Doe@example.com')).toBe(true);
		expect(formatUri('https://user:pass@example.com:8080/a/b?c=d#e')).toBe(true);
		expect(formatUri('http://[::1]/')).toBe(true);
		expect(formatUri('http://[v1.fe]/')).toBe(true);
		expect(formatUri('urn:isbn:9780141036144')).toBe(true);
		expect(formatUri('http://example.com/%6G')).toBe(false);
		expect(formatUri('1:b')).toBe(false);
		expect(formatUri('http://example.com/#a#b')).toBe(false);
		expect(formatUri('http://example.com:bad/')).toBe(false);
		expect(formatUri('http://example.com/?%6G')).toBe(false);
		expect(formatUri('http://user@@example.com')).toBe(false);
		expect(formatUri('http://[::1/')).toBe(false);
		expect(formatUri('http://[::1]:bad/')).toBe(false);

		expect(formatUriReference('//')).toBe(true);
		expect(formatUriReference('/a/b?c#d')).toBe(true);
		expect(formatUriReference('a/b')).toBe(true);
		expect(formatUriReference('1:b')).toBe(false);

		expect(formatIri('http://ƒøø.ßår/?∂éœ=πîx#πîüx')).toBe(true);
		expect(formatIri('http://2001:db8::1')).toBe(false);
		expect(formatIriReference('/âππ')).toBe(true);
		expect(formatIriReference('â:b')).toBe(false);
	});

	test('uri-template', () => {
		expect(formatUriTemplate('{+var}')).toBe(true);
		expect(formatUriTemplate('{a.b}')).toBe(true);
		expect(formatUriTemplate('http://example.com/{id}')).toBe(true);
		expect(formatUriTemplate('{v:0}')).toBe(false);
		expect(formatUriTemplate('{a-b}')).toBe(false);
		expect(formatUriTemplate('{')).toBe(false);
		expect(formatUriTemplate('}')).toBe(false);
		expect(formatUriTemplate('{}')).toBe(false);
		expect(formatUriTemplate('http://example.com/%6G')).toBe(false);
		expect(formatUriTemplate('a b')).toBe(false);
		expect(formatUriTemplate('{,}')).toBe(false);
	});

	test('regex', () => {
		expect(formatRegex('a|b')).toBe(true);
		expect(formatRegex('*a')).toBe(false);
	});
});

describe('format names', () => {
	test('turns a format into an import name', () => {
		expect(formatConstantBase('date-time')).toBe('formatDateTime');
	});

	test('allocates once and reuses the name', () => {
		const formatNames = new Map<string, string>();
		const usedNames = new Set(['formatEmail']);

		expect(formatNameFor('email', formatNames, usedNames)).toBe('formatEmail1');
		expect(formatNameFor('email', formatNames, usedNames)).toBe('formatEmail1');
	});
});
