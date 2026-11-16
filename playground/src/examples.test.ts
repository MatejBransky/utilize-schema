import { parse } from '@utilize/json-schema';
import { generate } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { examples } from './examples';

for (const example of examples) {
	test(`example "${example.name}" generates Zod code`, async () => {
		const parsed = example.files.map(parseJsonFile);

		expect(parsed.flatMap((file) => file.problems)).toEqual([]);

		const bundle = buildBundle(parsed, example.files[0]!.id);

		expect(bundle.root).not.toBeNull();
		expect(bundle.problems).toEqual([]);

		const { root } = await parse(bundle.root as never, {
			cwd: '/',
			fileName: bundle.rootFileName,
		});
		const code = generate(root, { importZod: true });

		expect(code).toContain('export const');
	});
}
