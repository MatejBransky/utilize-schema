import { describe, expect, test } from 'vitest';

import { compile, ts } from './test-utils';

describe('object generator', () => {
	test('empty object', async () => {
		const result = await compile({
			type: 'object',
		});
		expect(result).toMatchCode(ts`
      export const Root = z.object({})
      export type Root = z.infer<typeof Root>
    `);
	});
});
