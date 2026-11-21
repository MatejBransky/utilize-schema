import { generate as generateEffect } from '@utilize/effect';
import { parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { transformWithOxc } from 'vite';
import { afterAll, expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { exampleGeneratorOptions, type ExampleGeneratorOptions } from './exampleOptions';
import { examples, type Example } from './examples';
import { defaultFormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';
import {
	loadModule,
	rootValidator,
	validateModule,
	validateWithEffect,
	validateWithZod,
} from './runtime';

const directories: string[] = [];

afterAll(async () => {
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

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
			const code = generator.generate(root, exampleGeneratorOptions[example.id]);

			expect(code).toContain(generator.marker);
		});
	}

	test(`example "${example.name}" accepts and rejects its test data`, async () => {
		expect(example.cases.length).toBeGreaterThan(0);

		for (const target of ['zod', 'effect'] as const) {
			const { runtime } = generateCodeFor(
				target,
				await parseExample(example),
				defaultFormatMode,
				exampleGeneratorOptions[example.id]
			);

			if (!runtime || runtime.status !== 'generated' || !runtime.rootName) {
				throw new Error(`${example.name}: the ${target} validator was not generated.`);
			}

			const module = await importModule(runtime.code);
			const schema = rootValidator(module, runtime.rootName);
			const validate = target === 'zod' ? validateWithZod : validateWithEffect;

			for (const item of example.cases) {
				const result = validate(schema, item.data);
				const expected = item.expect === 'valid';

				expect(result.ok, `${example.name} / ${item.label} (${target})`).toBe(expected);
			}
		}
	});

	test(`example "${example.name}" runs its test data the way the playground does`, async () => {
		for (const target of ['zod', 'effect'] as const) {
			const { runtime: source } = generateCodeFor(
				target,
				await parseExample(example),
				defaultFormatMode,
				exampleGeneratorOptions[example.id]
			);

			if (!source || source.status !== 'generated' || !source.rootName) {
				throw new Error(`${example.name}: the ${target} validator was not generated.`);
			}

			// The page emits JavaScript with the Monaco TypeScript worker, which
			// `src/monaco/transpile.test.ts` covers. Node strips the types instead.
			const { code: javascript } = await transformWithOxc(source.code, 'schema.ts');
			const module = await loadModule(javascript);

			for (const item of example.cases) {
				const result = validateModule(target, module, source.rootName, item.data);

				expect(result.error, `${example.name} / ${item.label} (${target})`).toBeUndefined();
				expect(result.ok, `${example.name} / ${item.label} (${target})`).toBe(
					item.expect === 'valid'
				);
			}
		}
	});
}
