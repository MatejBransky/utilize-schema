import type { FileInfo } from '@apidevtools/json-schema-ref-parser';
import type { JSONSchema } from '@utilize/json-schema-core';
import { stripExtension } from '@utilize/json-schema-core';
import merge from 'lodash/merge';
import { expect, it } from 'vitest';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getWithCache } from '../http';
import { compile, type CompileOptions } from '../test-utils';

const dir = fileURLToPath(new URL('inputs', import.meta.url));

interface TestCase {
	input: JSONSchema;
	error?: true;
	exclude?: boolean;
	only?: boolean;
	options?: CompileOptions;
}

export function hasOnly() {
	return readdirSync(dir)
		.filter((_) => /^.*\.js$/.test(_))
		.map((_) => require(join(dir, _)))
		.some((_) => _.only);
}

export async function run() {
	// [filename, absolute dirname, contents][]
	const modules = await Promise.all(
		readdirSync(dir)
			.filter((_) => !_.includes('.ignore.') && _.includes('.input.'))
			.map(async (_) => [_, await import(join(dir, _))] as [string, TestCase])
	);

	// exporting `const only=true` will only run that test
	// exporting `const exclude=true` will not run that test
	const only = modules.find((_) => Boolean(_[1].only));

	if (only) {
		runOne(only[1], only[0]);
	} else {
		modules.filter((_) => !_[1].exclude).forEach((_) => runOne(_[1], _[0]));
	}
}

const httpWithCacheResolver = {
	order: 1,
	canRead: /^https?:/i,
	async read({ url }: FileInfo) {
		return await getWithCache(url);
	},
};

function runOne(exports: TestCase, name: string) {
	// log('blue', 'Running test', name)

	const options = merge<CompileOptions, CompileOptions>(
		{
			normalize: {
				fileName: stripExtension(name),
			},
			generate: { importZod: true },
			dereference: {
				cwd: join(fileURLToPath(new URL(import.meta.url)), 'inputs'),
				$refOptions: {
					resolve: { http: httpWithCacheResolver },
				},
			},
		},
		exports.options ?? {}
	);

	it(name, async () => {
		if (exports.error) {
			try {
				await compile(exports.input, options);
			} catch (e) {
				expect(e instanceof Error).toBe(true);
			}
		} else {
			expect(await compile(exports.input, options)).toMatchSnapshot();
		}
	});
}

await run();
