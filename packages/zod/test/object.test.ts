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

	test('emits __proto__ as a computed key and checks the raw input', async () => {
		await expect(
			compile({
				type: 'object',
				properties: { ['__proto__']: { type: 'number' } },
				required: ['__proto__'],
			})
		).toMatchCode(ts`
      export const Root = z
        .any()
        .superRefine((value, ctx) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, '__proto__');

            if (descriptor === undefined) {
              ctx.addIssue({
                code: 'custom',
                message: 'Required property is missing.',
                path: ['__proto__'],
              });
            } else {
              const result = z.number().safeParse(descriptor.value);

              if (!result.success) {
                for (const issue of result.error.issues) {
                  ctx.addIssue({
                    code: 'custom',
                    message: issue.message,
                    path: ['__proto__', ...issue.path],
                  });
                }
              }
            }
          }
        })
        .pipe(z.object({ ['__proto__']: z.number() }));
      export type Root = z.infer<typeof Root>;
    `);
	});
});
