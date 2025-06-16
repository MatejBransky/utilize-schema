import type { JSONSchema } from '@utilize/json-schema-core';
import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

interface SimpleSchemaTestCase {
	state?: 'skip' | 'todo' | 'only';
	name: string;
	schema: JSONSchema; // JSON Schema
	expected: Promise<string>; // TS code
}

describe('Simple schemas', () => {
	const testCases: SimpleSchemaTestCase[] = [
		{
			name: 'StringSchema',
			schema: { type: 'string' },
			expected: ts`
        import { z } from 'zod';

        export const StringSchema = z.string();
        export type StringSchema = z.infer<typeof StringSchema>;
      `,
		},
		{
			name: 'NumberSchema',
			schema: { type: 'number' },
			expected: ts`
        import { z } from 'zod';

        export const NumberSchema = z.number();
        export type NumberSchema = z.infer<typeof NumberSchema>;
      `,
		},
		{
			name: 'BooleanSchema',
			schema: { type: 'boolean' },
			expected: ts`
        import { z } from 'zod';

        export const BooleanSchema = z.boolean();
        export type BooleanSchema = z.infer<typeof BooleanSchema>;
      `,
		},
		{
			name: 'NullSchema',
			schema: { type: 'null' },
			expected: ts`
        import { z } from 'zod';

        export const NullSchema = z.null();
        export type NullSchema = z.infer<typeof NullSchema>;
      `,
		},
		{
			name: 'EnumSchema',
			schema: { type: 'string', enum: ['foo', 'bar'] },
			expected: ts`
        import { z } from 'zod';

        export const EnumSchema = z.enum(['foo', 'bar']);
        export type EnumSchema = z.infer<typeof EnumSchema>;
      `,
		},
		{
			name: 'SimpleObjectSchema',
			schema: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' },
				},
				required: ['name'],
			},
			expected: ts`
        import { z } from 'zod';

        export const SimpleObjectSchema = z.object({
          name: z.string(),
          age: z.number().optional(),
        });
        export type SimpleObjectSchema = z.infer<typeof SimpleObjectSchema>;
      `,
		},
		{
			name: 'ObjectWithAdditionalProperties',
			schema: {
				type: 'object',
				properties: { foo: { type: 'string' } },
				additionalProperties: { type: 'number' },
				required: ['foo'],
			},
			expected: ts`
        import { z } from 'zod';

        export const ObjectWithAdditionalProperties = z.object({
          foo: z.string(),
        }).catchall(z.number());
        export type ObjectWithAdditionalProperties = z.infer<typeof ObjectWithAdditionalProperties>;
      `,
		},
		{
			name: 'IntegerSchema',
			schema: { type: 'integer' },
			expected: ts`
        import { z } from 'zod';

        export const IntegerSchema = z.int();
        export type IntegerSchema = z.infer<typeof IntegerSchema>;
      `,
		},
		{
			name: 'NestedEnumSchema',
			schema: {
				type: 'object',
				properties: {
					status: { type: 'string', enum: ['active', 'inactive'] },
				},
				required: ['status'],
			},
			expected: ts`
        import { z } from 'zod';

        export const NestedEnumSchema = z.object({
          status: z.enum(['active', 'inactive']),
        });
        export type NestedEnumSchema = z.infer<typeof NestedEnumSchema>;
      `,
		},
		{
			name: 'ArrayOfStrings',
			schema: {
				type: 'array',
				items: { type: 'string' },
				minItems: 1,
				maxItems: 3,
			},
			expected: ts`
        import { z } from 'zod';

        export const ArrayOfStrings = z.array(z.string()).min(1).max(3);
        export type ArrayOfStrings = z.infer<typeof ArrayOfStrings>;
      `,
		},
		{
			name: 'TupleOfStringAndNumber',
			schema: {
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }],
				minItems: 2,
				maxItems: 2,
			},
			expected: ts`
        import { z } from 'zod';

        export const TupleOfStringAndNumber = z.tuple([z.string(), z.number()]);
        export type TupleOfStringAndNumber = z.infer<typeof TupleOfStringAndNumber>;
      `,
		},
		{
			name: 'EnumOfNumbersAndBooleans',
			schema: { enum: [1, 2, true, false] },
			expected: ts`
        import { z } from 'zod';

        export const EnumOfNumbersAndBooleans = z.enum([1, 2, true, false]);
        export type EnumOfNumbersAndBooleans = z.infer<typeof EnumOfNumbersAndBooleans>;
      `,
		},
		{
			name: 'LiteralNull',
			schema: { const: null },
			expected: ts`
        import { z } from 'zod';

        export const LiteralNull = z.literal(null);
        export type LiteralNull = z.infer<typeof LiteralNull>;
      `,
		},
		{
			name: 'UnionOfStringAndNumber',
			schema: { type: ['string', 'number'] },
			expected: ts`
        import { z } from 'zod';

        export const UnionOfStringAndNumber = z.union([z.string(), z.number()]);
        export type UnionOfStringAndNumber = z.infer<typeof UnionOfStringAndNumber>;
      `,
		},
		{
			name: 'IntersectionOfObjects',
			schema: {
				allOf: [
					{
						type: 'object',
						properties: { a: { type: 'string' } },
						required: ['a'],
					},
					{
						type: 'object',
						properties: { b: { type: 'number' } },
						required: ['b'],
					},
				],
			},
			expected: ts`
        import { z } from 'zod';

        export const IntersectionOfObjects = z.intersection(
          z.object({ 
            a: z.string() 
          }),
          z.object({ 
            b: z.number() 
          }),
        );
        export type IntersectionOfObjects = z.infer<typeof IntersectionOfObjects>;
      `,
		},
		{
			name: 'TupleWithSpread',
			schema: {
				type: 'array',
				items: [{ type: 'number' }, { type: 'boolean' }],
				additionalItems: { type: 'string' },
			},
			expected: ts`
        import { z } from 'zod';

        export const TupleWithSpread = z.tuple([z.number(), z.boolean()], z.string());
        export type TupleWithSpread = z.infer<typeof TupleWithSpread>;
      `,
		},
		{
			name: 'UntypedArray',
			schema: {
				type: 'array',
			},
			expected: ts`
        import { z } from 'zod';

        export const UntypedArray = z.array(z.unknown());
        export type UntypedArray = z.infer<typeof UntypedArray>;
      `,
		},
		{
			name: 'WithMeta',
			schema: {
				type: 'string',
				title: 'MyString',
				description: 'A simple string schema',
			},
			expected: ts`
        import { z } from 'zod';

        export const MyString = z.string().meta({ title: 'MyString', description: 'A simple string schema' });
        export type MyString = z.infer<typeof MyString>;
      `,
		},
		{
			name: 'WithDefault',
			schema: {
				type: 'string',
				default: 'default value',
			},
			expected: ts`
        import { z } from 'zod';

        export const WithDefault = z.string().default('default value');
        export type WithDefault = z.infer<typeof WithDefault>;
      `,
		},
		{
			name: 'NumberWithConstraints',
			schema: {
				type: 'number',
				minimum: 0,
				maximum: 100,
				multipleOf: 5,
			},
			expected: ts`
        import { z } from 'zod';

        export const NumberWithConstraints = z.number().min(0).max(100).multipleOf(5);
        export type NumberWithConstraints = z.infer<typeof NumberWithConstraints>;
      `,
		},
		{
			name: 'WithDefs',
			schema: {
				$defs: {
					MyString: { type: 'string', minLength: 3 },
					MyNumber: { type: 'number', minimum: 0 },
					Other: { type: 'string' },
				},
				type: 'object',
				properties: {
					str: { $ref: '#/$defs/MyString' },
					num: { $ref: '#/$defs/MyNumber' },
				},
				additionalProperties: { $ref: '#/$defs/Other' },
				required: ['str'],
			},
			expected: ts`
        import { z } from 'zod';

        export const MyString = z.string().min(3);
        export type MyString = z.infer<typeof MyString>;

        export const MyNumber = z.number().min(0);
        export type MyNumber = z.infer<typeof MyNumber>;

        export const Other = z.string();
        export type Other = z.infer<typeof Other>;

        export const WithDefs = z.object({
          str: MyString,
          num: MyNumber.optional(),
        }).catchall(Other);
        export type WithDefs = z.infer<typeof WithDefs>;
      `,
		},
	];

	testCases.forEach((testCase) => {
		const testMethod = testCase.state ? test[testCase.state] : test;
		testMethod(testCase.name, async () => {
			const code = await compile(testCase.schema, {
				fileName: `${testCase.name}.json`,
				deref: { cwd: process.cwd(), $refOptions: {} },
			});
			expect(code).toBe(await testCase.expected);
		});
	});
});
