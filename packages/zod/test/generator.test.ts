import { ASTKind, type ASTNode } from '@utilize/json-schema-core';
import { describe, expect, test } from 'vitest';

import { ts } from './test-utils';

import { generate } from '../src';

interface GeneratorTestCase {
	state?: 'skip' | 'todo' | 'only';
	test: string;
	node: ASTNode;
	expected: ReturnType<typeof ts>;
}

describe.todo('AST->Zod generator', () => {
	const testCases: GeneratorTestCase[] = [
		{
			test: 'generates Zod string schema with constraints',
			node: {
				kind: ASTKind.STRING,
				minLength: 3,
				maxLength: 10,
				pattern: '^[a-z]+$',
				meta: { description: 'lowercase string' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * lowercase string
         */
        export const schema = z.string().min(3).max(10).regex(/^[a-z]+$/).describe("lowercase string");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod number schema with constraints',
			node: {
				kind: ASTKind.NUMBER,
				minimum: 0,
				maximum: 100,
				multipleOf: 5,
				meta: { description: 'score from 0 to 100' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * score from 0 to 100
         */
        export const schema = z.number().min(0).max(100).multipleOf(5).describe("score from 0 to 100");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod boolean schema',
			node: {
				kind: ASTKind.BOOLEAN,
				meta: { description: 'flag' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * flag
         */
        export const schema = z.boolean().describe("flag");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod null schema',
			node: {
				kind: ASTKind.NULL,
				meta: { description: 'null value' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * null value
         */
        export const schema = z.null().describe("null value");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod enum schema',
			node: {
				kind: ASTKind.ENUM,
				values: ['red', 'green', 'blue'],
				meta: { description: 'color enum' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * color enum
         */
        export const schema = z.enum(["red", "green", "blue"]).describe("color enum");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod literal schema',
			node: {
				kind: ASTKind.LITERAL,
				value: 42,
				meta: { description: 'the answer' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * the answer
         */
        export const schema = z.literal(42).describe("the answer");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod array schema with constraints',
			node: {
				kind: ASTKind.ARRAY,
				items: { kind: ASTKind.STRING, standaloneName: 'item' },
				meta: { description: 'array of strings' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * array of strings
         */
        export const schema = z.array(z.string()).min(1).max(5).describe("array of strings");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod tuple schema',
			node: {
				kind: ASTKind.TUPLE,
				items: [
					{ kind: ASTKind.STRING, standaloneName: 'item1' },
					{ kind: ASTKind.NUMBER, standaloneName: 'item2' },
				],
				minItems: 2,
				meta: { description: 'tuple of string and number' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * tuple of string and number
         */
        export const schema = z.tuple([z.string(), z.number()]).describe("tuple of string and number");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod object schema with all property types',
			node: {
				kind: ASTKind.OBJECT,
				properties: [
					{
						ast: { kind: ASTKind.STRING, standaloneName: 'name' },
						keyName: 'name',
						isRequired: true,
						isPatternProperty: false,
					},
					{
						ast: { kind: ASTKind.NUMBER, standaloneName: 'age' },
						keyName: 'age',
						isRequired: false,
						isPatternProperty: false,
					},
				],
				superTypes: [],
				meta: { description: 'person object' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * person object
         */
        export const schema = z.object({
          name: z.string(),
          age: z.number().optional(),
        }).describe("person object");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod union schema',
			node: {
				kind: ASTKind.UNION,
				nodes: [
					{ kind: ASTKind.STRING, standaloneName: 'str' },
					{ kind: ASTKind.NUMBER, standaloneName: 'num' },
				],
				meta: { description: 'string or number' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * string or number
         */
        export const schema = z.union([z.string(), z.number()]).describe("string or number");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod intersection schema',
			node: {
				kind: ASTKind.INTERSECTION,
				nodes: [
					{
						kind: ASTKind.OBJECT,
						properties: [
							{
								ast: { kind: ASTKind.STRING, standaloneName: 'a' },
								keyName: 'a',
								isRequired: true,
								isPatternProperty: false,
							},
						],
						superTypes: [],
						standaloneName: 'A',
					},
					{
						kind: ASTKind.OBJECT,
						properties: [
							{
								ast: { kind: ASTKind.NUMBER, standaloneName: 'b' },
								keyName: 'b',
								isRequired: true,
								isPatternProperty: false,
							},
						],
						superTypes: [],
						standaloneName: 'B',
					},
				],
				meta: { description: 'intersection object' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * intersection object
         */
        export const schema = z.intersection(
          z.object({ a: z.string() }),
          z.object({ b: z.number() })
        ).describe("intersection object");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod schema with default values',
			node: {
				kind: ASTKind.STRING,
				default: 'foo',
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        export const schema = z.string().default("foo");
        export type schema = z.infer<typeof schema>;
      `,
		},
		{
			test: 'generates Zod schema with .describe() for title/description',
			node: {
				kind: ASTKind.NUMBER,
				meta: { description: 'A number', title: 'MyNumber' },
				standaloneName: 'schema',
			},
			expected: ts`
        import { z } from 'zod';

        /**
         * A number
         * @title MyNumber
         */
        export const schema = z.number().describe("A number");
        export type schema = z.infer<typeof schema>;
      `,
		},
	];

	testCases.forEach((testCase) => {
		const testMethod = testCase.state ? test[testCase.state] : test;
		testMethod(testCase.test, () => {
			const result = generate(testCase.node);
			expect(result).toBe(testCase.expected);
		});
	});
});
