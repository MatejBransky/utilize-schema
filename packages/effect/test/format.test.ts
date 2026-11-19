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
		['ipv4', '192.168.0.1', '999.168.0.1'],
		['date', '2024-02-29', '2023-02-29'],
		['date-time', '2024-02-29T12:00:00Z', '2024-02-29 12:00:00'],
		['duration', 'P3DT4H', 'three days'],
	])('asserts %s', async (format, valid, invalid) => {
		const Root = await compileToSchema({ type: 'string', format }, { formatMode: 'assert' });

		expect(Schema.is(Root)(valid), `${valid} should be valid`).toBe(true);
		expect(Schema.is(Root)(invalid), `${invalid} should be invalid`).toBe(false);
	});
});
