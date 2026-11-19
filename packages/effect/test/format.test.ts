import { Schema } from 'effect';
import { describe, expect, test } from 'vitest';

import { compile, compileToSchema } from './test-utils';

describe('formatMode', () => {
	test('annotates a known format by default', async () => {
		const code = await compile({ type: 'string', format: 'email' });

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
			{ type: 'string', format: 'email', minLength: 10, pattern: '@example\\.com$' },
			{ formatMode: 'assert' }
		);

		expect(Schema.is(Root)('user@example.com')).toBe(true);
		expect(Schema.is(Root)('user@other.com')).toBe(false);
		expect(Schema.is(Root)('a@b.co')).toBe(false);
	});

	test.each([
		['uuid', '2f8a1b3c-4d5e-6f70-8a9b-0c1d2e3f4a5b', 'not-a-uuid'],
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
		['time', '12:00:00Z', '12:00'],
		['date-time', '2024-02-29T12:00:00Z', '2024-02-29 12:00:00'],
		['duration', 'P3DT4H', 'three days'],
	])('asserts %s', async (format, valid, invalid) => {
		const Root = await compileToSchema({ type: 'string', format }, { formatMode: 'assert' });

		expect(Schema.is(Root)(valid), `${valid} should be valid`).toBe(true);
		expect(Schema.is(Root)(invalid), `${invalid} should be invalid`).toBe(false);
	});
});
