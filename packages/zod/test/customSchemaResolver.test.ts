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
					schema.format === 'date-time' ? 'z.iso.datetime({ offset: true })' : undefined,
			}
		);

		await expect(result).toMatchCode(ts`
      export const Root = z.object({
        created: z.iso.datetime({ offset: true }),
      });
      export type Root = z.infer<typeof Root>;
    `);
	});

	test('types a replaced node as unknown in the value type of a recursive schema', async () => {
		await expect(
			compile(
				{
					type: 'object',
					title: 'Node',
					properties: {
						created: { type: 'string', format: 'date-time' },
						children: { type: 'array', items: { $ref: '#' } },
					},
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) =>
						schema.format === 'date-time' ? 'z.coerce.date()' : undefined,
				}
			)
		).toMatchCode(ts`
      type NodeValue = { created: unknown; children?: NodeValue[] };
      export const Node: z.ZodType<NodeValue> = z
        .object({
          created: z.coerce.date(),
          get children() {
            return z.array(Node).optional();
          },
        })
        .meta({ title: 'Node' });
      export type Node = z.infer<typeof Node>;
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
