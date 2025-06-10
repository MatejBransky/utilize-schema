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
				required: ['name', 'age'],
			},
			expected: ts`
        import { z } from 'zod';

        export const SimpleObjectSchema = z.object({
          name: z.string(),
          age: z.number(),
        });
        export type SimpleObjectSchema = z.infer<typeof SimpleObjectSchema>;
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
