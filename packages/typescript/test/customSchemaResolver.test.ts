import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('customSchemaResolver', () => {
	test('replaces a matching property with a custom TypeScript type', async () => {
		await expect(
			compile(
				{
					type: 'object',
					properties: { created: { type: 'string', format: 'date-time' } },
					required: ['created'],
				},
				{
					customSchemaResolver: (schema) => (schema.format === 'date-time' ? 'Date' : undefined),
				}
			)
		).toMatchCode(ts`
      export interface Root {
        /**
         * @format date-time
         */
        created: Date;
        [key: string]: unknown;
      }
    `);
	});

	test('lets the resolver replace the root declaration instead of an interface', async () => {
		await expect(
			compile(
				{ type: 'object', title: 'Money', properties: { amount: { type: 'number' } } },
				{ customSchemaResolver: (schema) => (schema.title === 'Money' ? 'string' : undefined) }
			)
		).toMatchCode(ts`
      export type Money = string;
    `);
	});

	test('leaves unmatched nodes to the generator', async () => {
		await expect(compile({ type: 'string' }, { customSchemaResolver: () => undefined }))
			.toMatchCode(ts`
      export type Root = string;
    `);
	});
});
