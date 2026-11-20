import { type JSONSchema, Meta } from '@utilize/json-schema';
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

	test.each<[string, JSONSchema, unknown, unknown]>([
		['object', { type: 'object', enum: [{ a: 1 }, { b: 2 }] }, { b: 2 }, { c: 3 }],
		['record', { type: 'object', additionalProperties: true, enum: [{ a: 1 }] }, { a: 1 }, {}],
		['array', { type: 'array', enum: [[1], [2]] }, [2], [3]],
		['tuple', { type: 'array', items: [{ type: 'number' }], enum: [[1]] }, [1], [3]],
		['integer', { type: 'integer', enum: [1, 2] }, 2, 3],
	])('an %s enum with its type still checks the enum', async (_, schema, valid, invalid) => {
		const Root = await compileToZod(schema);

		expect(Root.safeParse(valid).success).toBe(true);
		expect(Root.safeParse(invalid).success).toBe(false);
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

	test('puts .readonly() on the union only', async () => {
		await expect(
			compile(
				{ type: ['array', 'null'], items: { type: 'string' }, readOnly: true },
				{ readOnlyKeyword: true }
			)
		).toMatchCode(ts`
			export const Root = z.union([z.array(z.string()), z.null()]).readonly();
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

	test.each([
		['the copy', ['properties', 'inline', 'properties', 'n']],
		['the named schema', ['definitions', 'Def', 'properties', 'n']],
	])('keeps a copy when customSchemaResolver replaces a node inside %s', async (_, path) => {
		const def: JSONSchema = { type: 'object', properties: { n: { type: 'number' } } };
		const code = await compile(
			{
				type: 'object',
				properties: { inline: structuredClone(def) },
				definitions: { Def: def },
			},
			{
				customSchemaResolver: (schema) =>
					schema[Meta].path.join('/') === path.join('/') ? "z.literal('custom')" : undefined,
			}
		);

		expect(code).toContain("z.literal('custom')");
		expect(code).not.toContain('inline: Def');
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

describe('an inline subschema repeated without a named schema', () => {
	const point: JSONSchema = {
		type: 'object',
		properties: { x: { type: 'number' }, y: { type: 'number' } },
		required: ['x', 'y'],
	};

	test('is declared once and referenced where it appears', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { start: structuredClone(point), end: structuredClone(point) },
			})
		).toMatchCode(ts`
			export const Start = z.object({ x: z.number(), y: z.number() });
			export type Start = z.infer<typeof Start>;

			export const Root = z.object({ start: Start.optional(), end: Start.optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('validates every place it appears', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: { start: structuredClone(point), end: structuredClone(point) },
		});

		expect(Root.safeParse({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }).success).toBe(true);
		expect(Root.safeParse({ start: { x: 1, y: 2 }, end: { x: 3 } }).success).toBe(false);
		expect(Root.safeParse({ start: { x: '1', y: 2 } }).success).toBe(false);
	});

	test('is shared between named schemas', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { $ref: '#/definitions/A' }, b: { $ref: '#/definitions/B' } },
				definitions: {
					A: { type: 'object', properties: { position: structuredClone(point) } },
					B: { type: 'object', properties: { location: structuredClone(point) } },
				},
			})
		).toMatchCode(ts`
			export const Position = z.object({ x: z.number(), y: z.number() });
			export type Position = z.infer<typeof Position>;

			export const B = z.object({ location: Position.optional() });
			export type B = z.infer<typeof B>;

			export const A = z.object({ position: Position.optional() });
			export type A = z.infer<typeof A>;

			export const Root = z.object({ a: A.optional(), b: B.optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('is named after its title', async () => {
		const titled = { ...structuredClone(point), title: 'Point' };
		const code = await compile({
			type: 'object',
			properties: { start: titled, end: structuredClone(titled) },
		});

		expect(code).toContain('export const Point = z');
		expect(code).toContain('start: Point.optional(), end: Point.optional()');
	});

	test('is named after array items and map values', async () => {
		const code = await compile({
			type: 'object',
			properties: {
				tags: { type: 'array', items: structuredClone(point) },
				byName: { type: 'object', additionalProperties: structuredClone(point) },
			},
		});

		expect(code).toContain('export const TagsItem = z.object({ x: z.number(), y: z.number() });');
		expect(code).toContain('tags: z.array(TagsItem).optional()');
		expect(code).toContain('z.record(z.string(), TagsItem)');
	});

	test('takes a free name next to a named schema', async () => {
		await expect(
			compile({
				type: 'object',
				properties: {
					start: structuredClone(point),
					end: structuredClone(point),
					other: { $ref: '#/definitions/Start' },
				},
				definitions: { Start: { type: 'string' } },
			})
		).toMatchCode(ts`
			export const Start = z.string();
			export type Start = z.infer<typeof Start>;

			export const Start1 = z.object({ x: z.number(), y: z.number() });
			export type Start1 = z.infer<typeof Start1>;

			export const Root = z.object({
				start: Start1.optional(),
				end: Start1.optional(),
				other: Start.optional(),
			});
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('passes the hoisted name through schemaName and typeName', async () => {
		const code = await compile(
			{
				type: 'object',
				properties: { start: structuredClone(point), end: structuredClone(point) },
			},
			{ schemaName: (name) => `${name}Schema`, typeName: (name) => `${name}Type` }
		);

		expect(code).toContain('export const StartSchema = z.object(');
		expect(code).toContain('export type StartType = z.infer<typeof StartSchema>;');
		expect(code).toContain('start: StartSchema.optional(), end: StartSchema.optional()');
	});

	test('declares only the outer schema when the inner one repeats only inside it', async () => {
		const line: JSONSchema = {
			type: 'object',
			properties: { from: structuredClone(point), to: structuredClone(point) },
		};

		await expect(
			compile({
				type: 'object',
				properties: { first: structuredClone(line), second: structuredClone(line) },
			})
		).toMatchCode(ts`
			export const From = z.object({ x: z.number(), y: z.number() });
			export type From = z.infer<typeof From>;

			export const First = z.object({ from: From.optional(), to: From.optional() });
			export type First = z.infer<typeof First>;

			export const Root = z.object({ first: First.optional(), second: First.optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('declares an inner schema that repeats once inside an outer one and once elsewhere', async () => {
		const line: JSONSchema = { type: 'object', properties: { from: structuredClone(point) } };

		await expect(
			compile({
				type: 'object',
				properties: {
					first: structuredClone(line),
					second: structuredClone(line),
					center: structuredClone(point),
				},
			})
		).toMatchCode(ts`
			export const From = z.object({ x: z.number(), y: z.number() });
			export type From = z.infer<typeof From>;

			export const First = z.object({ from: From.optional() });
			export type First = z.infer<typeof First>;

			export const Root = z.object({
				first: First.optional(),
				second: First.optional(),
				center: From.optional(),
			});
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('keeps a single keyword such as a type inline', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { a: { type: 'string' }, b: { type: 'string' } },
			})
		).toMatchCode(ts`
			export const Root = z.object({ a: z.string().optional(), b: z.string().optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('keeps the copies when customSchemaResolver replaces a node inside one', async () => {
		const code = await compile(
			{
				type: 'object',
				properties: { start: structuredClone(point), end: structuredClone(point) },
			},
			{
				customSchemaResolver: (schema) =>
					schema[Meta].path.join('/') === 'properties/end/properties/x'
						? "z.literal('custom')"
						: undefined,
			}
		);

		expect(code).not.toContain('export const Start');
		expect(code).toContain("x: z.literal('custom')");
	});

	test('declares no copy inside a node customSchemaResolver replaces', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: {
						pair: {
							type: 'object',
							properties: { p: structuredClone(point), q: structuredClone(point) },
						},
					},
				},
				{
					customSchemaResolver: (schema) =>
						schema[Meta].path.join('/') === 'properties/pair' ? 'z.literal(1)' : undefined,
				}
			)
		).toMatchCode(ts`
			export const Root = z.object({ pair: z.literal(1).optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('declares nothing for a repeated anyOf with a branch that accepts every value', async () => {
		const anything: JSONSchema = { anyOf: [structuredClone(point), {}] };

		await expect(
			compile({
				type: 'object',
				properties: { a: structuredClone(anything), b: structuredClone(anything) },
			})
		).toMatchCode(ts`
			export const Root = z.object({ a: z.unknown().optional(), b: z.unknown().optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('declares nothing for keywords that draft-07 ignores next to a $ref', async () => {
		const reference: JSONSchema = {
			$ref: '#/definitions/Def',
			properties: { p: structuredClone(point) },
		};

		await expect(
			compile({
				type: 'object',
				properties: {
					a: structuredClone(reference),
					b: structuredClone(reference),
					c: structuredClone(reference),
				},
				definitions: { Def: { type: 'string' } },
			})
		).toMatchCode(ts`
			export const Def = z.string();
			export type Def = z.infer<typeof Def>;

			export const Root = z.object({ a: Def.optional(), b: Def.optional(), c: Def.optional() });
			export type Root = z.infer<typeof Root>;
		`);
	});

	test('breaks a cycle through a repeated array of the recursive schema', async () => {
		const Root = await compileToZod({
			type: 'object',
			properties: {
				left: { type: 'array', items: { $ref: '#' } },
				right: { type: 'array', items: { $ref: '#' } },
			},
		});

		expect(Root.safeParse({ left: [{ right: [{}] }], right: [] }).success).toBe(true);
		expect(Root.safeParse({ left: [{ right: [1] }] }).success).toBe(false);
	});

	test('breaks a cycle through a repeated record of the recursive schema with z.lazy', async () => {
		const Root = await compileToZod({
			type: 'array',
			items: [
				{ type: 'object', additionalProperties: { type: 'array', items: { $ref: '#' } } },
				{ type: 'object', additionalProperties: { type: 'array', items: { $ref: '#' } } },
			],
		});

		expect(Root.safeParse([{ a: [[]] }, { b: [] }]).success).toBe(true);
		expect(Root.safeParse([{ a: [[1]] }]).success).toBe(false);
	});
});
