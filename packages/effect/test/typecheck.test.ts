import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile, type CompileOptions, type TestSchema } from './test-utils';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const tree: TestSchema = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		children: { type: 'array', items: { $ref: '#' } },
	},
	required: ['name'],
};

const mutualDefinitions: TestSchema = {
	type: 'object',
	properties: { a: { $ref: '#/$defs/A' } },
	$defs: {
		A: { type: 'object', properties: { b: { $ref: '#/$defs/B' } } },
		B: { type: 'object', properties: { a: { $ref: '#/$defs/A' } } },
	},
};

const recursiveArray: TestSchema = { type: 'array', items: { $ref: '#' } };

const recursiveTuple: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'array',
	prefixItems: [{ type: 'string' }, { $ref: '#' }],
	items: false,
};

const recursiveRecord: TestSchema = {
	type: 'object',
	additionalProperties: { $ref: '#' },
};

const looseRecursiveObject: TestSchema = {
	type: 'object',
	properties: { next: { $ref: '#' } },
	additionalProperties: true,
};

const recursiveAdditionalProperties: TestSchema = {
	type: 'object',
	properties: { name: { type: 'string' } },
	additionalProperties: { $ref: '#' },
};

const closedRecursiveObject: TestSchema = {
	type: 'object',
	properties: { child: { $ref: '#' } },
	additionalProperties: false,
};

const recursiveUnion: TestSchema = {
	type: ['object', 'boolean'],
	properties: {
		items: { anyOf: [{ $ref: '#' }, { $ref: '#/$defs/list' }] },
	},
	$defs: {
		list: { type: 'array', minItems: 1, items: { $ref: '#' } },
	},
};

const allOf: TestSchema = {
	allOf: [
		{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
		{ type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
	],
};

const filters: TestSchema = {
	type: 'object',
	properties: {
		country: { type: 'string' },
		postal: { type: 'string' },
	},
	required: ['country'],
	if: { properties: { country: { const: 'US' } }, required: ['country'] },
	then: { properties: { postal: { pattern: '^[0-9]{5}$' } }, required: ['postal'] },
	else: { properties: { postal: { minLength: 3 } } },
	dependencies: { country: ['postal'] },
	propertyNames: { pattern: '^[a-z]+$' },
};

const contains: TestSchema = {
	type: 'array',
	items: { type: 'number' },
	contains: { const: 0 },
	uniqueItems: true,
};

const unevaluated = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: { name: { type: 'string' } },
	unevaluatedProperties: false,
} as TestSchema;

const booleanRefs = {
	type: 'object',
	properties: {
		allowed: { $ref: '#/$defs/allowed' },
		denied: { $ref: '#/$defs/denied' },
	},
	$defs: { allowed: true, denied: false },
} as unknown as TestSchema;

const nested: TestSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		id: { type: 'string' },
		tags: { type: 'array', items: { type: 'string' } },
		pair: {
			type: 'array',
			prefixItems: [{ type: 'number' }, { type: 'string' }],
		} as TestSchema,
		status: { enum: ['open', 'closed'] },
		meta: { type: 'object', additionalProperties: { type: 'number' } },
	},
	required: ['id'],
};

const patternProperties: TestSchema = {
	type: 'object',
	patternProperties: { '^a': { type: 'string' }, '^b': { type: 'integer' } },
	additionalProperties: false,
};

const patternPropertiesWithRequired: TestSchema = {
	type: 'object',
	required: ['a'],
	patternProperties: { '^a': { type: 'string' } },
	additionalProperties: { type: 'integer' },
};

describe('generated schemas type-check', () => {
	test('annotate recursive schemas with a value type', async () => {
		await expect(
			typeCheck({
				'Tree.ts': tree,
				'MutualDefinitions.ts': mutualDefinitions,
				'RecursiveArray.ts': recursiveArray,
				'RecursiveTuple.ts': recursiveTuple,
				'RecursiveRecord.ts': recursiveRecord,
				'LooseRecursiveObject.ts': looseRecursiveObject,
				'RecursiveAdditionalProperties.ts': recursiveAdditionalProperties,
				'ClosedRecursiveObject.ts': closedRecursiveObject,
				'RecursiveUnion.ts': recursiveUnion,
				'AllOf.ts': allOf,
				'Filters.ts': filters,
				'Contains.ts': contains,
				'Nested.ts': nested,
				'BooleanRefs.ts': booleanRefs,
				'Unevaluated.ts': unevaluated,
				'PatternProperties.ts': patternProperties,
				'PatternPropertiesWithRequired.ts': patternPropertiesWithRequired,
			})
		).resolves.toBeUndefined();
	});

	test('type-check mapped schema and type names', async () => {
		await expect(
			typeCheck(
				{
					'Tree.ts': tree,
					'MutualDefinitions.ts': mutualDefinitions,
					'Nested.ts': nested,
				},
				{ schemaName: (name) => `${name}Schema` }
			)
		).resolves.toBeUndefined();
	});
});

async function typeCheck(schemas: Record<string, TestSchema>, options: CompileOptions = {}) {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const files: string[] = [];

	try {
		for (const [name, schema] of Object.entries(schemas)) {
			const code = await compile(schema, { importEffect: true, ...options });
			const file = join(directory, name);

			await writeFile(file, code);
			files.push(file);
		}

		try {
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
			);
		} catch (error) {
			const output = error as { stdout?: string; stderr?: string };

			throw new Error(`tsc failed:\n${output.stdout ?? ''}${output.stderr ?? ''}`, {
				cause: error,
			});
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
