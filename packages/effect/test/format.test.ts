import { Schema } from 'effect';
import { describe, expect, test } from 'vitest';

import { compile, compileToSchema } from './test-utils';

describe('formatMode', () => {
	test('asserts a known format by default', async () => {
		const code = await compile({ type: 'string', format: 'email' });

		expect(code).toContain('const formatEmail = Schema.makeFilter<string>(');
		expect(code).toContain("Schema.String.check(formatEmail).annotate({ format: 'email' })");
	});

	test('keeps a known format as metadata in annotate mode', async () => {
		const code = await compile({ type: 'string', format: 'email' }, { formatMode: 'annotate' });

		expect(code).toContain("Schema.String.annotate({ format: 'email' })");
		expect(code).not.toContain('Schema.isPattern');
	});

	test('annotates an unknown format in assert mode', async () => {
		const code = await compile(
			{ type: 'string', format: 'not-a-format' },
			{ formatMode: 'assert' }
		);

		expect(code).toContain("annotate({ format: 'not-a-format' })");
		expect(code).not.toContain('isPattern');
	});

	test('emits one constant per format and reuses it', async () => {
		const code = await compile(
			{
				type: 'object',
				properties: {
					email: { type: 'string', format: 'email' },
					backup: { type: 'string', format: 'email' },
					createdAt: { type: 'string', format: 'date-time' },
				},
			},
			{ formatMode: 'assert' }
		);

		expect(code.match(/const formatEmail = /g)).toHaveLength(1);
		expect(code.match(/const formatDateTime = /g)).toHaveLength(1);
		expect(code.match(/Schema\.String\.check\(formatEmail\)/g)).toHaveLength(2);
	});

	test('asserts a known format', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'email' },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('user@example.com')).toBe(true);
		expect(Schema.is(Root)('not-an-email')).toBe(false);
	});

	test('keeps string constraints next to the format check', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'email', minLength: 10, pattern: String.raw`@example\.com$` },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('user@example.com')).toBe(true);
		expect(Schema.is(Root)('user@other.com')).toBe(false);
		expect(Schema.is(Root)('a@b.co')).toBe(false);
	});

	test.each([
		['uuid', '99c17cbb-656f-f64a-940f-1a4568f03487', 'not-a-uuid'],
		['url', 'https://example.com/a?b=1', 'not a url'],
		['emoji', '😀', 'abc'],
		['base64', 'aGVsbG8=', 'not base64!'],
		['base64url', 'aGVsbG8', 'a+b/c'],
		['nanoid', 'V1StGXR8_Z5jdHi6B-myT', 'short'],
		['cuid', 'cjld2cjxh0000qzrmn831i7rn', 'not-cuid'],
		['cuid2', 'tz4a98xxat96iws9zmbrgj3a', '!'],
		['ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'not-a-ulid'],
		['ipv4', '192.168.0.1', '999.168.0.1'],
		['ipv6', '::1', 'not-ip'],
		['cidrv4', '192.168.0.0/24', '192.168.0.0/33'],
		['cidrv6', '::1/128', '::1/129'],
		['date', '2024-02-29', '2023-02-29'],
		['time', '12:00:00Z', '12:00:00'],
		['date-time', '2024-02-29T12:00:00Z', '2024-02-29 12:00:00'],
		['duration', 'P3DT4H', 'P1Y2D'],
	])('asserts %s', async (format, valid, invalid) => {
		const Root = await compileToSchema({ type: 'string', format }, { formatMode: 'assert' });

		expect(Schema.is(Root)(valid), `${valid} should be valid`).toBe(true);
		expect(Schema.is(Root)(invalid), `${invalid} should be invalid`).toBe(false);
	});

	test.each([
		['email', '"joe bloggs"@example.com', 'te..st@example.com'],
		['idn-email', '실례@실례.테스트', 'δοκιμή@-example.com'],
		['hostname', 'xn--9n2bp8q.xn--9t4b11yi5a', 'ab--cd.example'],
		['idn-hostname', 'a。b', 'a·l'],
		['uri', 'mailto:John.Doe@example.com', 'http://example.com/%6G'],
		['uri-reference', '//', '1:b'],
		['iri', 'http://ƒøø.ßår/?∂éœ=πîx#πîüx', 'http://2001:db8::1'],
		['iri-reference', '/âππ', 'â:b'],
		['json-pointer', '/foo/bar~0', '/~2'],
		['relative-json-pointer', '0#', '01/a'],
		['regex', 'a|b', '*a'],
		['uri-template', '{+var}', '{v:0}'],
	])('asserts %s with structural validation', async (format, valid, invalid) => {
		const Root = await compileToSchema({ type: 'string', format }, { formatMode: 'assert' });

		expect(Schema.is(Root)(valid), `${valid} should be valid`).toBe(true);
		expect(Schema.is(Root)(invalid), `${invalid} should be invalid`).toBe(false);
	});

	test.each([
		['http://json-schema.org/draft-04/schema#'],
		['http://json-schema.org/draft-06/schema#'],
	])('uses legacy hostname rules for %s', async ($schema) => {
		const Root = await compileToSchema(
			{ $schema, type: 'string', format: 'hostname' },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('ab--cd.example')).toBe(true);
		expect(Schema.is(Root)('-hostname')).toBe(false);
	});

	test.each([
		['time', '15:59:60-08:00', '23:59:60+01:00'],
		['uri-template', '{a.b}', '{a-b}'],
	])('keeps %s inside its RFC grammar', async (format, valid, invalid) => {
		const Root = await compileToSchema({ type: 'string', format }, { formatMode: 'assert' });

		expect(Schema.is(Root)(valid), `${valid} should be valid`).toBe(true);
		expect(Schema.is(Root)(invalid), `${invalid} should be invalid`).toBe(false);
	});

	test('asserts a format on an untyped schema by default', async () => {
		const Root = await compileToSchema({ format: 'email' });

		expect(Schema.is(Root)('user@example.com')).toBe(true);
		expect(Schema.is(Root)('not-an-email')).toBe(false);
		// `format` only constrains strings, so other JSON types still pass.
		expect(Schema.is(Root)(42)).toBe(true);
	});

	test('keeps a format on an untyped schema as metadata in annotate mode', async () => {
		const Root = await compileToSchema({ format: 'email' }, { formatMode: 'annotate' });

		expect(Schema.is(Root)('not-an-email')).toBe(true);
	});

	test('treats inherited object keys as unknown formats', async () => {
		for (const format of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
			const code = await compile({ type: 'string', format }, { formatMode: 'assert' });

			expect(code).toContain(`annotate({ format: '${format}' })`);
			expect(code).not.toMatch(/const format[A-Z]/);
		}
	});

	test('accepts years before 0100 in dates', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'date' },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('0001-01-01')).toBe(true);
		expect(Schema.is(Root)('0000-02-29')).toBe(true);
		expect(Schema.is(Root)('0001-02-29')).toBe(false);
	});

	test('requires an RFC 3339 offset and bounds time fields', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'time' },
			{ formatMode: 'assert' }
		);

		for (const value of ['08:30:06Z', '08:30:06+00:20', '12:34:56-00:00', '23:20:50.52Z']) {
			expect(Schema.is(Root)(value), `${value} should be valid`).toBe(true);
		}

		for (const value of ['24:00:00Z', '99:99:99', '12:00:00', '08:30:06+01']) {
			expect(Schema.is(Root)(value), `${value} should be invalid`).toBe(false);
		}
	});

	test('date-time requires a valid calendar date and checks leap seconds in UTC', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'date-time' },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('2024-02-29T12:00:00Z')).toBe(true);
		expect(Schema.is(Root)('2024-02-29T12:00:00+01:00')).toBe(true);
		expect(Schema.is(Root)('1998-12-31T15:59:60.123-08:00')).toBe(true);
		expect(Schema.is(Root)('2023-02-29T12:00:00Z')).toBe(false);
		expect(Schema.is(Root)('1998-12-31T22:59:60Z')).toBe(false);
		expect(Schema.is(Root)('2024-02-29T99:99:99Z')).toBe(false);
	});

	test('rejects IPv6 values that close the bracket early', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'ipv6' },
			{ formatMode: 'assert' }
		);

		for (const value of ['::1]/x', '::1]#frag', '::1]/@evil.com', '::1/64', '::1\n']) {
			expect(Schema.is(Root)(value), `${value} should be invalid`).toBe(false);
		}
	});

	test('emoji accepts flags and keycaps but not a lone joiner', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'emoji' },
			{ formatMode: 'assert' }
		);

		for (const value of ['😀', '🇨🇿', '1️⃣', '👨‍👩‍👧']) {
			expect(Schema.is(Root)(value), `${value} should be valid`).toBe(true);
		}

		expect(Schema.is(Root)('\u200d')).toBe(false);
	});

	test('base64url rejects lengths base64 cannot produce', async () => {
		const Root = await compileToSchema(
			{ type: 'string', format: 'base64url' },
			{ formatMode: 'assert' }
		);

		for (const value of ['', 'ab', 'abc', 'abcd', 'aGVsbG8']) {
			expect(Schema.is(Root)(value), `${value} should be valid`).toBe(true);
		}

		for (const value of ['A', 'abcde']) {
			expect(Schema.is(Root)(value), `${value} should be invalid`).toBe(false);
		}
	});
});
