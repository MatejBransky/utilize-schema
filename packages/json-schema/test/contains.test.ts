import { describe, expect, test } from 'vitest';

import { containsBounds } from '../src/contains';
import { dialects } from '../src/dialect';
import type { ParsedJSONSchemaObject } from '../src/model';

const draft07 = dialects['draft-07'];
const twentyNineteen = dialects['2019-09'];

function schema(value: unknown): ParsedJSONSchemaObject {
	return value as ParsedJSONSchemaObject;
}

describe('containsBounds', () => {
	test('returns undefined without an applicable contains keyword', () => {
		expect(containsBounds(schema({ type: 'array' }), draft07)).toBeUndefined();
		expect(containsBounds(schema({ contains: {} }), dialects['draft-04'])).toBeUndefined();
	});

	test('defaults to one uncounted match', () => {
		expect(containsBounds(schema({ contains: {} }), draft07)).toEqual({
			min: 1,
			max: undefined,
			counted: false,
		});
	});

	test('counts explicit minContains and maxContains', () => {
		expect(
			containsBounds(schema({ contains: {}, minContains: 2, maxContains: 4 }), twentyNineteen)
		).toEqual({ min: 2, max: 4, counted: true });
	});

	test('allows zero minimum when maxContains bounds the count', () => {
		expect(
			containsBounds(schema({ contains: {}, minContains: 0, maxContains: 2 }), twentyNineteen)
		).toEqual({
			min: 0,
			max: 2,
			counted: true,
		});
	});

	test('returns undefined when the bounds allow any number', () => {
		expect(
			containsBounds(schema({ contains: {}, minContains: 0 }), twentyNineteen)
		).toBeUndefined();
	});

	test('ignores count keywords the dialect does not support', () => {
		expect(containsBounds(schema({ contains: {}, minContains: 2 }), draft07)).toEqual({
			min: 1,
			max: undefined,
			counted: false,
		});
	});
});
