import { generate as generateEffect } from '@utilize/effect';
import { parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';
import { expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { exampleGeneratorOptions, type ExampleGeneratorOptions } from './exampleOptions';
import { examples } from './examples';

const generators: Array<{
	name: string;
	marker: string;
	generate: (root: ParsedJSONSchema, options?: ExampleGeneratorOptions) => string;
}> = [
	{
		name: 'Zod',
		marker: 'export const',
		generate: (root, options) => generateZod(root, { importZod: true, ...options?.zod }),
	},
	{
		name: 'Effect Schema',
		marker: 'export const',
		generate: (root, options) => generateEffect(root, { importEffect: true, ...options?.effect }),
	},
	{
		name: 'TypeScript',
		marker: 'export ',
		generate: (root, options) => generateTypeScript(root, { ...options?.typescript }),
	},
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
			const code = generator.generate(root, exampleGeneratorOptions[example.id]);

			expect(code).toContain(generator.marker);
		});
	}
}
