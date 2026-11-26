import { parse } from '@utilize/json-schema';
import { expect, test } from 'vitest';

import { defaultFormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';

for (const target of ['zod', 'effect'] as const) {
	for (const schema of [true, false]) {
		test(`${target} preserves a ${schema} root for direct validation`, async () => {
			const { root } = await parse(schema, { cwd: '/', fileName: 'schema.json' });
			const { runtime } = generateCodeFor(target, root, defaultFormatMode);

			expect(runtime).toMatchObject({ status: 'generated', booleanRoot: schema });
			expect(runtime?.status === 'generated' && runtime.rootName).toBeUndefined();
		});
	}
}
