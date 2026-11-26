import { parse } from '@utilize/json-schema';
import { expect, test } from 'vitest';

import { defaultFormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';

for (const target of ['zod', 'effect'] as const) {
	for (const schema of [true, false]) {
		test(`${target} exposes a ${schema} root as a runnable module`, async () => {
			const { root } = await parse(schema, { cwd: '/', fileName: 'schema.json' });
			const { code, runtime } = generateCodeFor(target, root, defaultFormatMode);

			expect(runtime).toMatchObject({
				status: 'generated',
				code,
				runtimeCode: expect.any(String),
				rootName: 'Root',
			});

			if (runtime?.status !== 'generated') {
				throw new Error('Expected generated runtime source.');
			}

			if (target === 'zod') {
				expect(code.trim().replace(/;$/, '')).toBe(schema ? 'z.any()' : 'z.never()');
				expect(runtime.runtimeCode).toContain("import { z } from 'zod';");
				expect(runtime.runtimeCode).toContain(
					`export const Root = ${schema ? 'z.any()' : 'z.never()'};`
				);
			} else {
				expect(runtime.runtimeCode).toBe(code);
				expect(code).toContain('export const Root');
			}
		});
	}
}
