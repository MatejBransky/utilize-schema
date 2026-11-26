import { generate as generateEffect } from '@utilize/effect';
import { assert, isJSONSchema, parse } from '@utilize/json-schema';
import type { ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { transformWithOxc } from 'vite';
import { afterAll, expect, test } from 'vitest';

import './polyfills';

import { buildBundle, parseJsonFile } from './bundle';
import { generatorOptionsFor } from './exampleOptions';
import type { ExampleGeneratorOptions } from './exampleOptions';
import { examples } from './examples';
import type { Example } from './examples';
import { defaultFormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';
import type { GeneratedModule } from './runtime';
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

const generators: {
	name: string;
	marker: string;
	generate: (root: ParsedJSONSchema, options?: ExampleGeneratorOptions) => string;
}[] = [
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

// On-demand transforms time out alongside the browser project on shared CI runners.
const runtimeTestTimeout = 30_000;

async function parseExample(example: Example) {
	const parsed = example.files.map(parseJsonFile);

	expect(parsed.flatMap((file) => file.problems)).toEqual([]);

	const bundle = buildBundle(parsed, example.files[0].id);

	expect(bundle.root).not.toBeNull();
	expect(bundle.problems).toEqual([]);
	assert(isJSONSchema(bundle.root), 'Expected the bundled root to be a schema.');

	const { root } = await parse(bundle.root, {
		cwd: '/',
		fileName: bundle.rootFileName,
	});

	return root;
}

async function importModule(code: string): Promise<GeneratedModule> {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	directories.push(directory);

	try {
		const filePath = join(directory, 'schema.ts');

		await writeFile(filePath, code);

		const namespace: unknown = await import(/* @vite-ignore */ filePath);

		if (typeof namespace !== 'object' || namespace === null) {
			throw new Error('The generated module did not produce an export object.');
		}

		return { namespace };
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

for (const example of examples) {
	for (const generator of generators) {
		test(`example "${example.name}" generates ${generator.name} code`, async () => {
			const root = await parseExample(example);
			const code = generator.generate(root, generatorOptionsFor(example.id));

			expect(code).toContain(generator.marker);
		});
	}

	test(
		`example "${example.name}" accepts and rejects its test data`,
		async () => {
			expect(example.cases.length).toBeGreaterThan(0);

			for (const target of ['zod', 'effect'] as const) {
				const { runtime } = generateCodeFor(
					target,
					await parseExample(example),
					defaultFormatMode,
					generatorOptionsFor(example.id)
				);

				if (!runtime || runtime.status !== 'generated' || !runtime.rootName) {
					throw new Error(`${example.name}: the ${target} validator was not generated.`);
				}

				const module = await importModule(runtime.code);
				const schema = rootValidator(module, runtime.rootName);
				const validate = target === 'zod' ? validateWithZod : validateWithEffect;

				for (const item of example.cases) {
					const result = await validate(schema, item.data);
					const expected = item.expect === 'valid';

					expect(result.ok, `${example.name} / ${item.label} (${target})`).toBe(expected);
				}
			}
		},
		runtimeTestTimeout
	);

	test(`example "${example.name}" runs its test data the way the playground does`, async () => {
		for (const target of ['zod', 'effect'] as const) {
			const { runtime: source } = generateCodeFor(
				target,
				await parseExample(example),
				defaultFormatMode,
				generatorOptionsFor(example.id)
			);

			if (!source || source.status !== 'generated' || !source.rootName) {
				throw new Error(`${example.name}: the ${target} validator was not generated.`);
			}

			// The page emits JavaScript with the Monaco TypeScript worker, which
			// `src/monaco/transpile.test.ts` covers. Node strips the types instead.
			const { code: javascript } = await transformWithOxc(source.code, 'schema.ts');
			const module = await loadModule(javascript);

			for (const item of example.cases) {
				const result = await validateModule(target, module, source.rootName, item.data);

				expect(result.error, `${example.name} / ${item.label} (${target})`).toBeUndefined();
				expect(result.ok, `${example.name} / ${item.label} (${target})`).toBe(
					item.expect === 'valid'
				);
			}
		}
	});
}
