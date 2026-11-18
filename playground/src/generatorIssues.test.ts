import { parse } from '@utilize/json-schema';
import { transformWithOxc } from 'vite';
import { expect, test } from 'vitest';

import './polyfills';

import { generateCodeFor } from './generateCode';
import { loadModule, validateModule } from './runtime';

/** Three independent failures: a missing key, a wrong type, and a bad pattern. */
const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	title: 'Person',
	type: 'object',
	properties: {
		firstName: { type: 'string' },
		lastName: { type: 'string' },
		age: { type: 'integer' },
		address: {
			type: 'object',
			properties: { zip: { type: 'string', pattern: '^[0-9]{5}$' } },
		},
	},
	required: ['firstName', 'lastName'],
};

const data = {
	firstName: 'Ada',
	age: '36',
	address: { zip: '1245' },
};

const expectedPaths = ['$.lastName', '$.age', '$.address.zip'];

for (const target of ['zod', 'effect'] as const) {
	test(`${target} reports every invalid field instead of stopping at the first`, async () => {
		const { root } = await parse(structuredClone(schema) as never, {
			cwd: '/',
			fileName: 'person.json',
		});
		const { runtime } = generateCodeFor(target, root);

		if (!runtime || runtime.status !== 'generated' || !runtime.rootName) {
			throw new Error(`The ${target} validator was not generated.`);
		}

		const { code: javascript } = await transformWithOxc(runtime.code, 'schema.ts');
		const module = await loadModule(javascript);
		const result = validateModule(target, module, runtime.rootName, data);

		expect(result.error).toBeUndefined();
		expect(result.ok).toBe(false);
		expect(result.issues.map((issue) => issue.path)).toHaveLength(expectedPaths.length);
		expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(expectedPaths));
	});
}
