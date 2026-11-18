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
