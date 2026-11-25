import type { ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { renderJsDoc } from '../src/renderType';

describe('renderJsDoc', () => {
	test('returns no lines without an object schema', () => {
		expect(renderJsDoc(undefined)).toEqual([]);
		expect(renderJsDoc(false)).toEqual([]);
	});

	test('renders indented text and tags in annotation order', () => {
		const schema = {
			title: 'A title',
			description: 'First line.\nSecond line.',
			deprecated: true,
			default: { enabled: true },
			format: 'email',
			examples: ['a@example.com'],
		} as unknown as ParsedJSONSchemaObject;

		expect(renderJsDoc(schema, 1, 'OtherName')).toEqual([
			'\t/**',
			'\t * A title',
			'\t * First line.',
			'\t * Second line.',
			'\t *',
			'\t * @deprecated',
			'\t * @default {"enabled":true}',
			'\t * @format email',
			'\t * @example "a@example.com"',
			'\t */',
		]);
	});
});
