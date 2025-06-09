import { ASTKind, ASTNode } from '@utilize/json-schema-core';
import { expect, test } from 'vitest';

import { ts } from './test-utils';

import { generate } from '../src';

// Skipped tests with example input/output for incremental implementation

test.skip('generates Zod string schema with constraints', () => {
	const node: ASTNode = {
		kind: ASTKind.STRING,
		params: { minLength: 3, maxLength: 10, pattern: '^[a-z]+$' },
		description: 'lowercase string',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * lowercase string
			 */
			export const schema = z.string().min(3).max(10).regex(/^[a-z]+$/).describe("lowercase string");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod number schema with constraints', () => {
	const node: ASTNode = {
		kind: 'number',
		runtime: { minimum: 0, maximum: 100, multipleOf: 5 },
		description: 'score from 0 to 100',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * score from 0 to 100
			 */
			export const schema = z.number().min(0).max(100).multipleOf(5).describe("score from 0 to 100");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod boolean schema', () => {
	const node: ASTNode = { kind: 'boolean', description: 'flag' };
	expect(generate(node)).toBe(
		ts`
			/**
			 * flag
			 */
			export const schema = z.boolean().describe("flag");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod null schema', () => {
	const node: ASTNode = { kind: 'null', description: 'null value' };
	expect(generate(node)).toBe(
		ts`
			/**
			 * null value
			 */
			export const schema = z.null().describe("null value");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod enum schema', () => {
	const node: ASTNode = {
		kind: 'enum',
		values: ['red', 'green', 'blue'],
		description: 'color enum',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * color enum
			 */
			export const schema = z.enum(["red", "green", "blue"]).describe("color enum");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod literal schema', () => {
	const node: ASTNode = {
		kind: 'literal',
		value: 42,
		description: 'the answer',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * the answer
			 */
			export const schema = z.literal(42).describe("the answer");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod array schema with constraints', () => {
	const node: ASTNode = {
		kind: 'array',
		items: { kind: 'string' },
		runtime: { minItems: 1, maxItems: 5 },
		description: 'array of strings',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * array of strings
			 */
			export const schema = z.array(z.string()).min(1).max(5).describe("array of strings");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod tuple schema', () => {
	const node: ASTNode = {
		kind: 'tuple',
		items: [{ kind: 'string' }, { kind: 'number' }],
		description: 'tuple of string and number',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * tuple of string and number
			 */
			export const schema = z.tuple([z.string(), z.number()]).describe("tuple of string and number");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod object schema with all property types', () => {
	const node: ASTNode = {
		kind: 'object',
		properties: {
			name: { kind: 'string' },
			age: { kind: 'number' },
		},
		required: ['name'],
		description: 'person object',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * person object
			 */
			export const schema = z.object({
				name: z.string(),
				age: z.number().optional(),
			}).describe("person object");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod union schema', () => {
	const node: ASTNode = {
		kind: 'union',
		options: [{ kind: 'string' }, { kind: 'number' }],
		description: 'string or number',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * string or number
			 */
			export const schema = z.union([z.string(), z.number()]).describe("string or number");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod intersection schema', () => {
	const node: ASTNode = {
		kind: 'intersection',
		options: [
			{
				kind: 'object',
				properties: { a: { kind: 'string' } },
				required: ['a'],
			},
			{
				kind: 'object',
				properties: { b: { kind: 'number' } },
				required: ['b'],
			},
		],
		description: 'intersection object',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * intersection object
			 */
			export const schema = z.intersection(
				z.object({ a: z.string() }),
				z.object({ b: z.number() })
			).describe("intersection object");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod schema with default values', () => {
	const node: ASTNode = {
		kind: 'string',
		default: 'foo',
	};
	expect(generate(node)).toBe(
		ts`
			export const schema = z.string().default("foo");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('generates Zod schema with .describe() for title/description', () => {
	const node: ASTNode = {
		kind: 'number',
		description: 'A number',
		title: 'MyNumber',
	};
	expect(generate(node)).toBe(
		ts`
			/**
			 * A number
			 * @title MyNumber
			 */
			export const schema = z.number().describe("A number");
			export type Schema = z.infer<typeof schema>;
		`
	);
});

test.skip('emits comments or metadata for unsupported/partially supported features', () => {
	const node: ASTNode = {
		kind: 'object',
		properties: {},
		if: {
			kind: 'object',
			properties: { foo: { kind: 'string' } },
			required: ['foo'],
		},
		then: {
			kind: 'object',
			properties: { bar: { kind: 'number' } },
			required: ['bar'],
		},
	};
	expect(generate(node)).toContain('/* Unsupported: if/then/else */');
});

test.skip('generates correct TypeScript types using z.infer', () => {
	// This is covered by all previous tests, but can be extended for more complex cases.
});

test.skip('handles $ref provenance for naming and comments', () => {
	const node: ASTNode = {
		kind: 'string',
		meta: { provenance: '#/definitions/Foo' },
	};
	expect(generate(node)).toContain('/* Source: #/definitions/Foo */');
});
