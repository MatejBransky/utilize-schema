import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('customSchemaResolver', () => {
	test('replaces a matching schema node with a custom Zod expression', async () => {
		const result = compile(
			{
				type: 'object',
				properties: { created: { type: 'string', format: 'date-time' } },
				required: ['created'],
			},
			{
				customSchemaResolver: (schema) =>
					schema.format === 'date-time' ? 'z.string().datetime({ offset: true })' : undefined,
			}
		);

		await expect(result).toMatchCode(ts`
      export const Root = z.object({
        created: z.string().datetime({ offset: true }),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('leaves unmatched nodes to the generator', async () => {
		await expect(
			compile(
				{ type: 'object', properties: { name: { type: 'string' } } },
				{ customSchemaResolver: () => undefined }
			)
		).toMatchCode(ts`
      export const Root = z.object({ name: z.string().optional() });
      export type Root = z.infer<typeof Root>;
    `);
	});
});
