import { describe, expect, test } from 'vitest';

import { containsBounds } from '../src/contains';
import { dialects } from '../src/dialect';
import { Meta } from '../src/model';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src/model';

const draft07 = dialects['draft-07'];
const twentyNineteen = dialects['2019-09'];
const testMeta: Partial<Meta> = {
	fileName: 'Test.json',
	filePath: '#',
	path: [],
	parent: null,
};

function schema<T extends JSONSchema>(value: T): T & ParsedJSONSchemaObject {
	defineMeta(value, testMeta);

	return value;
}

function defineMeta<T extends object>(
	value: T,
	meta: Partial<Meta>
): asserts value is T & ParsedJSONSchemaObject {
	Object.defineProperty(value, Meta, {
		enumerable: false,
		value: meta,
		writable: true,
		configurable: true,
	});
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
