import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('customSchemaResolver', () => {
	test('replaces a matching schema node with a custom Effect Schema expression', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { created: { type: 'string', format: 'date-time' } },
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) =>
						schema.format === 'date-time' ? 'Schema.String' : undefined,
				}
			)
		).toMatchCode(ts`
      export const Root = Schema.StructWithRest(
        Schema.Struct({ created: Schema.String }),
        [Schema.Record(Schema.String, Schema.Json)]
      );

      export type Root = typeof Root.Type;
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
						schema.format === 'date-time' ? 'Schema.Finite' : undefined,
				}
			)
		).toMatchCode(ts`
      type NodeValue = { created: unknown; children?: ReadonlyArray<NodeValue> };

      export const Node: Schema.Codec<NodeValue> = Schema.StructWithRest(
        Schema.Struct({
          created: Schema.Finite,
          children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Node))),
        }),
        [Schema.Record(Schema.String, Schema.Json)]
      ).annotate({ title: 'Node' });

      export type Node = typeof Node.Type;
    `);
	});

	test('replaces a single type of a type list, like the Zod generator', async () => {
		await expect(
			compile(
				{ type: ['string', 'null'], format: 'date-time' },
				{
					customSchemaResolver: (schema) =>
						schema.type === 'string' && schema.format === 'date-time'
							? 'Schema.Finite'
							: undefined,
				}
			)
		).toMatchCode(ts`
      export const Root = Schema.Union([Schema.Finite, Schema.Null]).annotate({ format: 'date-time' });

      export type Root = typeof Root.Type;
    `);
	});

	test('leaves unmatched nodes to the generator', async () => {
		await expect(compile({ type: 'string' }, { customSchemaResolver: () => undefined }))
			.toMatchCode(ts`
      export const Root = Schema.String;

      export type Root = typeof Root.Type;
    `);
	});
});
