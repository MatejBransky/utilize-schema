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
		await expect(
			compile({
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
			})
		).toMatchCode(ts`
      export const MyType = z.string();
      export type MyType = z.infer<typeof MyType>;

      export const MyType2 = z.number();
      export type MyType2 = z.infer<typeof MyType2>;

      export const Unknown = z.object({
        field: MyType.optional(),
        field2: MyType2.optional(),
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
});
