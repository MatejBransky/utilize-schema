import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { compile, compileToZod, ts } from './test-utils';

describe('const and enum next to a type they already satisfy', () => {
	test('a string const with "type": "string" is only a literal', async () => {
		await expect(compile({ type: 'string', const: 'circle' })).toMatchCode(ts`
			export const Root = z.literal('circle');
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('a string enum with "type": "string" is only an enum', async () => {
		await expect(compile({ type: 'string', enum: ['mm', 'cm'] })).toMatchCode(ts`
			export const Root = z.enum(['mm', 'cm']);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('an enum with a nullable type array is only an enum', async () => {
		await expect(compile({ type: ['string', 'null'], enum: ['mm', null] })).toMatchCode(ts`
			export const Root = z.literal(['mm', null]);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('an integer const with "type": "integer" is only a literal', async () => {
		await expect(compile({ type: 'integer', const: 3 })).toMatchCode(ts`
			export const Root = z.literal(3);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('keeps the type when a value does not satisfy it', async () => {
		const Root = await compileToZod({ type: 'integer', enum: [1, 1.5] });

		expect(Root.safeParse(1).success).toBe(true);
		expect(Root.safeParse(1.5).success).toBe(false);
	});

	test('keeps the type in draft-04, which ignores const', async () => {
		const Root = await compileToZod({
			$schema: 'http://json-schema.org/draft-04/schema#',
			type: ['string', 'null'],
			const: 'a',
		});

		expect(Root.safeParse('b').success).toBe(true);
		expect(Root.safeParse(null).success).toBe(true);
		expect(Root.safeParse(1).success).toBe(false);
	});

	test('keeps the type when other constraints sit next to it', async () => {
		const Root = await compileToZod({ type: 'string', enum: ['a', 'abc'], minLength: 2 });

		expect(Root.safeParse('abc').success).toBe(true);
		expect(Root.safeParse('a').success).toBe(false);
	});
});

describe('a type array with annotations', () => {
	test('puts the annotations on the union only, not on every type', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					label: {
						$id: 'label',
						description: 'An optional label',
						examples: ['a'],
						type: ['string', 'null'],
					},
				},
			})
		).toMatchCode(ts`
			export const Root = z.object({
				label: z
					.union([z.string(), z.null()])
					.meta({ id: 'label', description: 'An optional label', examples: ['a'] })
					.optional(),
			});
			export type Root = z.infer<typeof Root>;
		`);
	});
});

describe('an anyOf with a branch that accepts every value', () => {
	const tagged: JSONSchema = {
		oneOf: [
			{
				type: 'object',
				properties: { type: { type: 'string', const: 'int' }, value: { type: 'integer' } },
				required: ['type', 'value'],
			},
			{
				type: 'object',
				properties: { type: { type: 'string', const: 'text' }, value: { type: 'string' } },
				required: ['type', 'value'],
			},
		],
	};

	test('generates no code for the anyOf', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { label: { type: 'string' } },
				required: ['label'],
				anyOf: [tagged, {}],
			})
		).toMatchCode(ts`
			export const Root = z.object({ label: z.string() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test.each([
		['true', true],
		['an empty schema', {}],
		['an annotation-only schema', { description: 'Anything else', $comment: 'catch-all' }],
	] as const)(
		'generates the same code as without the anyOf when a branch is %s',
		async (_, branch) => {
			await expect(compile({ minLength: 2, anyOf: [{ type: 'string' }, branch] })).toMatchCode(
				compile({ minLength: 2 })
			);
		}
	);

	test('still accepts values that match no other branch', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { label: { type: 'string' } },
			required: ['label'],
			anyOf: [tagged, {}],
		});

		expect(Root.safeParse({ label: 'a', type: 'other' }).success).toBe(true);
		expect(Root.safeParse({ type: 'int', value: 1 }).success).toBe(false);
	});
});

describe('a oneOf whose branches cannot match the same value', () => {
	const tag = (value: string, valueType: 'integer' | 'string'): JSONSchema => ({
		type: 'object',
		properties: { type: { type: 'string', const: value }, value: { type: valueType } },
		required: ['type', 'value'],
	});

	test('different consts become a plain union', async () => {
		await expect(
			compile({
				description: 'The kind of shape',
				oneOf: [
					{ description: 'A circle', type: 'string', const: 'circle' },
					{ description: 'A square', type: 'string', const: 'square' },
				],
			})
		).toMatchCode(ts`
			export const Root = z
				.union([
					z.literal('circle').meta({ description: 'A circle' }),
					z.literal('square').meta({ description: 'A square' }),
				])
				.meta({ description: 'The kind of shape' });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('objects with a different const on the same required property become a plain union', async () => {
		await expect(compile({ oneOf: [tag('int', 'integer'), tag('text', 'string')] })).toMatchCode(ts`
			export const Root = z.union([
				z.object({ type: z.literal('int'), value: z.int() }),
				z.object({ type: z.literal('text'), value: z.string() }),
			]);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('branches of different types become a plain union', async () => {
		await expect(compile({ oneOf: [{ type: 'string' }, { type: 'boolean' }, { enum: [1, 2] }] }))
			.toMatchCode(ts`
			export const Root = z.union([z.string(), z.boolean(), z.literal([1, 2])]);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('follows a $ref to tell the branches apart', async () => {
		await expect(
			compile({
				oneOf: [{ $ref: '#/definitions/Int' }, { $ref: '#/definitions/Text' }],
				definitions: { Int: tag('int', 'integer'), Text: tag('text', 'string') },
			})
		).toMatchCode(ts`
			export const Text = z.object({ type: z.literal('text'), value: z.string() });
			export type Text = z.infer<typeof Text>;

			export const Int = z.object({ type: z.literal('int'), value: z.int() });
			export type Int = z.infer<typeof Int>;

			export const Root = z.union([Int, Text]);
			export type Root = z.infer<typeof Root>;
		`);
	});

	test.each<[string, JSONSchema[]]>([
		['enums share a value', [{ enum: ['a', 'b'] }, { enum: ['b', 'c'] }]],
		['an integer is also a number', [{ type: 'integer' }, { type: 'number' }]],
		['a const has the type of the other branch', [{ const: 'a' }, { type: 'string' }]],
		[
			'the tag is not required',
			[
				{ type: 'object', properties: { kind: { const: 'a' } } },
				{ type: 'object', properties: { kind: { const: 'b' } } },
			],
		],
		[
			'non-objects match both tagged branches',
			[
				{ properties: { kind: { const: 'a' } }, required: ['kind'] },
				{ properties: { kind: { const: 'b' } }, required: ['kind'] },
			],
		],
		['a branch has no constraint', [{ const: 'a' }, {}]],
	])('keeps the exactly-one check when %s', async (_, oneOf) => {
		expect(await compile({ oneOf })).toContain('oneOfSchema([');
	});

	test('the union accepts and rejects the same values as oneOf', async () => {
		const Root = await compileToZod({ oneOf: [tag('int', 'integer'), tag('text', 'string')] });

		expect(Root.safeParse({ type: 'int', value: 1 }).success).toBe(true);
		expect(Root.safeParse({ type: 'text', value: 'a' }).success).toBe(true);
		expect(Root.safeParse({ type: 'int', value: 'a' }).success).toBe(false);
		expect(Root.safeParse({ type: 'other', value: 1 }).success).toBe(false);
	});
});

describe('an inline subschema identical to a named schema', () => {
	const value: JSONSchema = {
		oneOf: [
			{ type: 'object', properties: { int: { type: 'integer' } }, required: ['int'] },
			{ type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
		],
	};

	test('generates the same code as a $ref to the named schema', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { value: { $ref: '#/definitions/Value' }, inline: structuredClone(value) },
				definitions: { Value: value },
			})
		).toMatchCode(
			compile({
				type: 'object',
				properties: {
					value: { $ref: '#/definitions/Value' },
					inline: { $ref: '#/definitions/Value' },
				},
				definitions: { Value: value },
			})
		);
	});

	test('keeps a copy that differs in an annotation', async () => {
		const code = await compile({
			type: 'object',
			properties: { inline: { ...structuredClone(value), description: 'Not quite the same' } },
			definitions: { Value: value },
		});

		expect(code).toContain('inline: oneOfSchema([');
	});

	test('keeps a single keyword such as a type inline', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { name: { type: 'string' } },
				definitions: { Name: { type: 'string' } },
			})
		).toMatchCode(ts`
			export const Name = z.string();
			export type Name = z.infer<typeof Name>;

			export const Root = z.object({ name: z.string().optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('refers to a recursive schema whose copy closes a new cycle', async () => {
		const node: JSONSchema = {
			type: 'object',
			properties: { next: { $ref: '#/definitions/Wrapper' } },
		};
		const Root = await compileToZod({
			type: 'object',
			properties: { wrapper: { $ref: '#/definitions/Wrapper' } },
			definitions: {
				Node: node,
				Wrapper: { type: 'object', properties: { node: structuredClone(node) } },
			},
		});

		expect(Root.safeParse({ wrapper: { node: { next: { node: {} } } } }).success).toBe(true);
		expect(Root.safeParse({ wrapper: { node: { next: { node: 1 } } } }).success).toBe(false);
	});
});
