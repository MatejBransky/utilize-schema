import { generate as generateEffect } from '@utilize/effect';
import { parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateZod } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { examples } from './examples';

const generators: Array<{
	name: string;
	generate: (root: ParsedJSONSchema) => string;
}> = [
	{ name: 'Zod', generate: (root) => generateZod(root, { importZod: true }) },
	{ name: 'Effect Schema', generate: (root) => generateEffect(root, { importEffect: true }) },
];

for (const example of examples) {
	for (const generator of generators) {
		test(`example "${example.name}" generates ${generator.name} code`, async () => {
			const parsed = example.files.map(parseJsonFile);

			expect(parsed.flatMap((file) => file.problems)).toEqual([]);

			const bundle = buildBundle(parsed, example.files[0]!.id);

			expect(bundle.root).not.toBeNull();
			expect(bundle.problems).toEqual([]);

			const { root } = await parse(bundle.root as never, {
				cwd: '/',
				fileName: bundle.rootFileName,
			});
			const code = generator.generate(root);

			expect(code).toContain('export const');
		});
	}
}
