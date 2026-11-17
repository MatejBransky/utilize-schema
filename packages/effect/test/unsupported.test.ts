import { describe, expect, test } from 'vitest';

import { UnsupportedEffectSchemaFeatureError } from '../src';
import { compile, type TestSchema } from './test-utils';

const unsupported: Array<[string, TestSchema]> = [
	['minContains', { type: 'array', contains: { type: 'string' }, minContains: 1 }],
	['maxContains', { type: 'array', contains: { type: 'string' }, maxContains: 2 }],
	['patternProperties', { type: 'object', patternProperties: { '^a': { type: 'string' } } }],
];

describe('unsupported keywords', () => {
	test.each(unsupported)('rejects %s', async (_name, schema) => {
		await expect(compile(schema)).rejects.toBeInstanceOf(UnsupportedEffectSchemaFeatureError);
	});

	test('rejects a $ref combined with constraint siblings', async () => {
		await expect(
			compile({
				$defs: { A: { type: 'object' } },
				type: 'object',
				properties: { value: { $ref: '#/$defs/A', required: ['a'] } },
			})
		).rejects.toThrow(/cannot be combined with required/);
	});

	test('rejects allOf branches that declare the same property', async () => {
		await expect(
			compile({
				allOf: [
					{ type: 'object', properties: { a: { type: 'string' } } },
					{ type: 'object', properties: { a: { type: 'number' } } },
				],
			})
		).rejects.toThrow(/declared by more than one subschema/);
	});

	test('rejects allOf branches that are not objects', async () => {
		await expect(compile({ allOf: [{ type: 'string' }] })).rejects.toThrow(
			/only object subschemas can be merged/
		);
	});

	test('rejects non-primitive const values', async () => {
		await expect(compile({ const: { a: 1 } })).rejects.toThrow(
			/only primitive values are supported/
		);
	});
});
