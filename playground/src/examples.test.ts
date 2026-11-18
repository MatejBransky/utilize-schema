import { generate as generateEffect } from '@utilize/effect';
import { parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { examples, type Example } from './examples';
import { rootDeclarationName } from './generateCode';
import { rootValidator, validateWithEffect, validateWithZod } from './runtime';

const directories: string[] = [];

afterAll(async () => {
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

const generators: Array<{
	name: string;
	marker: string;
	generate: (root: ParsedJSONSchema) => string;
}> = [
	{
		name: 'Zod',
		marker: 'export const',
		generate: (root) => generateZod(root, { importZod: true }),
	},
	{
		name: 'Effect Schema',
		marker: 'export const',
		generate: (root) => generateEffect(root, { importEffect: true }),
	},
	{
		name: 'TypeScript',
		marker: 'export ',
		generate: (root) => generateTypeScript(root),
	},
];

async function parseExample(example: Example) {
	const parsed = example.files.map(parseJsonFile);

	expect(parsed.flatMap((file) => file.problems)).toEqual([]);

	const bundle = buildBundle(parsed, example.files[0]!.id);

	expect(bundle.root).not.toBeNull();
	expect(bundle.problems).toEqual([]);

	const { root } = await parse(bundle.root as never, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});

	return root;
}

/** Runs generated code the same way a consumer would import it. */
async function importModule(code: string): Promise<Record<string, unknown>> {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	directories.push(directory);

	try {
		const filePath = join(directory, 'schema.ts');

		await writeFile(filePath, code);

		return (await import(/* @vite-ignore */ filePath)) as Record<string, unknown>;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

for (const example of examples) {
	for (const generator of generators) {
		test(`example "${example.name}" generates ${generator.name} code`, async () => {
			const root = await parseExample(example);
			const code = generator.generate(root);

			expect(code).toContain(generator.marker);
		});
	}

	test(`example "${example.name}" accepts and rejects its test data`, async () => {
		const root = await parseExample(example);
		const zod = await importModule(generateZod(root, { importZod: true }));
		const effect = await importModule(generateEffect(root, { importEffect: true }));
		const rootName = rootDeclarationName(root)!;

		expect(example.cases.length).toBeGreaterThan(0);

		for (const item of example.cases) {
			const zodResult = validateWithZod(rootValidator(zod, rootName), item.data);
			const effectResult = validateWithEffect(rootValidator(effect, rootName), item.data);
			const expected = item.expect === 'valid';

			expect(zodResult.ok, `${example.name} / ${item.label} (Zod)`).toBe(expected);
			expect(effectResult.ok, `${example.name} / ${item.label} (Effect Schema)`).toBe(expected);
		}
	});

}
