import { describe, expect, test } from 'vitest';

import { compile, ts } from '../test-utils';

describe('reference', () => {
	test('root $ref', async () => {
		await expect(
			compile({
				$ref: '#/definitions/MyType',
				definitions: {
					MyType: { type: 'string' },
				},
			})
		).toMatchCode(ts`
      export const Unknown = z.string();
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('$defs', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				field: { $ref: '#/$defs/MyType' },
				field2: { $ref: '#/$defs/MyType2' },
			},
			$defs: {
				MyType: { type: 'string' },
				MyType2: { type: 'number' },
				MyType3: { type: 'boolean' },
			},
		});

		expect(result).toMatchCode(ts`
      export const MyType = z.string();
      export type MyType = z.infer<typeof MyType>;

      export const MyType2 = z.number();
      export type MyType2 = z.infer<typeof MyType2>;

      export const Unknown = z.object({
        get field() {
          return MyType.optional();
        },
        get field2() {
          return MyType2.optional();
        },
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('cyclic reference', async () => {
		const result = await compile({
			type: 'object',
			properties: {
				value: { type: 'string' },
				next: { $ref: '#' },
			},
			required: ['value'],
		});

		expect(result).toMatchCode(ts`
      export const Unknown = z.object({
        value: z.string(),
        get next() {
          return Unknown.optional();
        },
      });
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});

	test('external $ref', async () => {
		const result = await compile(
			{
				type: 'object',
				oneOf: [
					{ $ref: './definitions/External.json' },
					{ $ref: '#/$defs/Internal' },
				],
				$defs: {
					Internal: { type: 'string' },
				},
			},
			{ dereference: { cwd: __dirname + '/e2e', $refOptions: {} } }
		);

		console.log('*result', result);

		expect(result).toMatchCode(ts`
      export const External = z.object({
        field: z.string().optional(),
      });
      export type External = z.infer<typeof External>;

      export const Internal = z.string();
      export type Internal = z.infer<typeof Internal>;

      export const Unknown = z.union([External, Internal]);
      export type Unknown = z.infer<typeof Unknown>;
    `);
	});
});
