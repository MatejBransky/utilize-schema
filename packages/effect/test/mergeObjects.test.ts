import { describe, expect, test } from 'vitest';

import { type ParsedJSONSchema, type ParsedJSONSchemaObject, parse } from '@utilize/json-schema';

import { UnresolvedReferenceError } from '../src/errors';
import { mergeObjectSchemas } from '../src/mergeObjects';

function object(schema: Record<string, unknown>): ParsedJSONSchemaObject {
	return schema as unknown as ParsedJSONSchemaObject;
}

describe('mergeObjectSchemas', () => {
	test('merges disjoint properties and string requirements in declaration order', () => {
		expect(
			mergeObjectSchemas([
				object({ type: 'object', properties: { a: true }, required: ['a', 1] }),
				object({ properties: { b: false }, required: ['b'] }),
			])
		).toEqual({
			merged: {
				type: 'object',
				properties: { a: true, b: false },
				required: ['a', 'b'],
			},
		});
	});

	test('keeps the additionalProperties schema identity when every member agrees', () => {
		const additional = object({ type: 'string' });
		const result = mergeObjectSchemas([
			object({ additionalProperties: additional }),
			object({ additionalProperties: additional }),
		]);

		expect(result.merged).toBeDefined();
		if (result.merged !== undefined && result.merged !== false) {
			expect(result.merged.additionalProperties).toBe(additional);
		}
	});

	test('ignores additionalProperties true', () => {
		expect(
			mergeObjectSchemas([
				object({ properties: { a: true }, additionalProperties: true }),
				object({ properties: { b: true } }),
			])
		).toEqual({
			merged: {
				type: 'object',
				properties: { a: true, b: true },
				required: [],
			},
		});
	});

	test('reports cross-member additionalProperties before duplicate properties', () => {
		expect(
			mergeObjectSchemas([
				object({ properties: { a: true }, additionalProperties: false }),
				object({ properties: { a: true } }),
			])
		).toEqual({
			reason: '"additionalProperties" does not consider properties declared by another subschema',
		});
	});

	test('rejects unsupported keywords before checking property conflicts', () => {
		expect(
			mergeObjectSchemas([
				object({ properties: { a: true }, not: false }),
				object({ properties: { a: true } }),
			])
		).toEqual({ reason: '"not" cannot be merged' });
	});

	test('returns false for a false member and rejects non-object members', () => {
		expect(mergeObjectSchemas([false])).toEqual({ merged: false });
		expect(mergeObjectSchemas([true])).toEqual({ reason: 'only object subschemas can be merged' });
	});

	test('throws for an unresolved reference', () => {
		expect(() => mergeObjectSchemas([object({ $ref: '#/$defs/Missing' })])).toThrow(
			UnresolvedReferenceError
		);
	});

	test('merges the target of a resolved reference', async () => {
		const parsed = await parse(
			{
				$defs: { Base: { properties: { a: true } } },
				allOf: [{ $ref: '#/$defs/Base' }, { properties: { b: true } }],
			},
			{ cwd: __dirname, fileName: 'Root.json' }
		);
		const members = (parsed.root as ParsedJSONSchemaObject).allOf as ParsedJSONSchema[];

		expect(mergeObjectSchemas(members)).toEqual({
			merged: {
				type: 'object',
				properties: { a: true, b: true },
				required: [],
			},
		});
	});
});
