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

	test('leaves unmatched nodes to the generator', async () => {
		await expect(compile({ type: 'string' }, { customSchemaResolver: () => undefined }))
			.toMatchCode(ts`
      export const Root = Schema.String;

      export type Root = typeof Root.Type;
    `);
	});
});
