import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const treeSchema: JSONSchema = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		children: { type: 'array', items: { $ref: '#' } },
	},
	required: ['name'],
};

const objectArraySchema: JSONSchema = {
	type: 'object',
	properties: { list: { $ref: './definitions/ListCycle.json' } },
};

const crossFileSchema: JSONSchema = {
	type: 'object',
	properties: { a: { $ref: './definitions/CycleA.json' } },
};

const mutualDefsSchema: JSONSchema = {
	type: 'object',
	properties: { a: { $ref: '#/$defs/A' } },
	$defs: {
		A: { type: 'object', properties: { b: { $ref: '#/$defs/B' } } },
		B: { type: 'object', properties: { a: { $ref: '#/$defs/A' } } },
	},
};

const arrayPairSchema: JSONSchema = {
	type: 'object',
	properties: { a: { $ref: './definitions/ArrayPairA.json' } },
};

const recursiveAdditionalPropertiesSchema: JSONSchema = {
	type: 'object',
	properties: { name: { type: 'string' } },
	additionalProperties: { $ref: '#' },
};

const recursiveRecordSchema: JSONSchema = {
	type: 'object',
	additionalProperties: { $ref: '#' },
};

const looseRecursiveObjectSchema: JSONSchema = {
	type: 'object',
	properties: { next: { $ref: '#' } },
	additionalProperties: true,
};

const recursiveArraySchema: JSONSchema = {
	type: 'array',
	items: { $ref: '#' },
};

const recursiveTupleSchema: JSONSchema = {
	type: 'array',
	items: [{ $ref: '#' }],
};

const defaultOverRecursiveUnionSchema: JSONSchema = {
	type: ['object', 'boolean'],
	properties: {
		items: {
			anyOf: [{ $ref: '#' }, { $ref: '#/definitions/schemaArray' }],
			default: true,
		},
	},
	definitions: {
		schemaArray: {
			type: 'array',
			minItems: 1,
			items: { $ref: '#' },
		},
	},
};

describe('generated recursive schemas type-check', () => {
	test('infer recursive value types with TypeScript', async () => {
		await expect(
			typeCheck({
				'Tree.ts': treeSchema,
				'ObjectArray.ts': objectArraySchema,
				'CrossFile.ts': crossFileSchema,
				'MutualDefs.ts': mutualDefsSchema,
				'ArrayPair.ts': arrayPairSchema,
				'AdditionalProperties.ts': recursiveAdditionalPropertiesSchema,
				'Record.ts': recursiveRecordSchema,
				'LooseObject.ts': looseRecursiveObjectSchema,
				'Array.ts': recursiveArraySchema,
				'Tuple.ts': recursiveTupleSchema,
				'DefaultOverRecursiveUnion.ts': defaultOverRecursiveUnionSchema,
			})
		).resolves.toBeUndefined();
	});
});

async function typeCheck(schemas: Record<string, JSONSchema>) {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const files: string[] = [];

	try {
		for (const [name, schema] of Object.entries(schemas)) {
			const code = await compile(schema, { importZod: true });
			const file = join(directory, name);
			await writeFile(file, code);
			files.push(file);
		}

		expect(() =>
			execFileSync(
				process.execPath,
				[
					tsc,
					'--ignoreConfig',
					'--noEmit',
					'--strict',
					'--skipLibCheck',
					'--module',
					'esnext',
					'--moduleResolution',
					'bundler',
					'--target',
					'esnext',
					...files,
				],
				{ encoding: 'utf8', stdio: 'pipe' }
			)
		).not.toThrow();
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
