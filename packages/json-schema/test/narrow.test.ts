import { describe, expect, test } from 'vitest';

import { dialects } from '../src/dialect';
import { isParsedJSONSchemaObject, Meta } from '../src/model';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src/model';
import { narrowUntypedSchema } from '../src/narrow';

const draft07 = dialects['draft-07'];
const twentyTwentyTwelve = dialects['2020-12'];
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

describe('narrowUntypedSchema', () => {
	test('leaves values without a target type or object schema unchanged', () => {
		const node = schema({ minLength: 1 });

		expect(narrowUntypedSchema(node, undefined, draft07)).toBe(node);
		expect(narrowUntypedSchema(true, 'string', draft07)).toBe(true);
	});

	const nodeCases: [string, JSONSchema][] = [
		['type', { type: 'string', minLength: 1 }],
		['$ref', { $ref: '#/x' }],
		['anyOf', { anyOf: [{ type: 'string' }] }],
		['oneOf', { oneOf: [{ type: 'string' }] }],
		['allOf', { allOf: [{ type: 'string' }] }],
		['const', { const: 'x' }],
		['enum', { enum: ['x'] }],
	];

	test.each(nodeCases)('does not narrow a node with %s', (_name, value) => {
		const node = schema(value);

		expect(narrowUntypedSchema(node, 'string', draft07)).toBe(node);
	});

	test('does not narrow when no target-type keyword applies', () => {
		const node = schema({ title: 'Nothing to narrow' });

		expect(narrowUntypedSchema(node, 'string', draft07)).toBe(node);
	});

	test('adds the target type when a type-specific keyword applies', () => {
		const node = schema({ minLength: 2 });
		const narrowed = narrowUntypedSchema(node, 'string', draft07);

		if (!isParsedJSONSchemaObject(narrowed)) {
			throw new Error('Expected a parsed schema object');
		}

		expect(narrowed).not.toBe(node);
		expect(narrowed.type).toBe('string');
	});

	test('ignores a keyword that the dialect does not support', () => {
		const node = schema({ prefixItems: [{ type: 'string' }] });

		expect(narrowUntypedSchema(node, 'array', draft07)).toBe(node);
		expect(narrowUntypedSchema(node, 'array', twentyTwentyTwelve)).not.toBe(node);
	});

	test('treats normalized dependencies as type-specific in every dialect', () => {
		const node = schema({ dependencies: { a: ['b'] } });
		const narrowed = narrowUntypedSchema(node, 'object', draft07);

		if (!isParsedJSONSchemaObject(narrowed)) {
			throw new Error('Expected a parsed schema object');
		}

		expect(narrowed.type).toBe('object');
	});
});
