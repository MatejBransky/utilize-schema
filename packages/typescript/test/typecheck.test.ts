import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { commandOutput, compile } from './test-utils';
import type { TestSchema } from './test-utils';

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
	type: 'array',
	prefixItems: [{ type: 'string' }, { $ref: '#' }],
	items: false,
};

const recursiveRecord: TestSchema = { type: 'object', additionalProperties: { $ref: '#' } };

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

const unions: TestSchema = {
	oneOf: [
		{ type: 'object', properties: { kind: { const: 'a' } }, required: ['kind'] },
		{ type: 'object', properties: { kind: { const: 'b' } }, required: ['kind'] },
	],
};

const typedAdditionalProperties: TestSchema = {
	type: 'object',
	properties: {
		known: { type: 'string' },
		optional: { type: 'number' },
		frozen: { type: 'boolean', readOnly: true },
	},
	required: ['known'],
	additionalProperties: { type: 'string' },
};

const patterns: TestSchema = {
	type: 'object',
	properties: { id: { type: 'string' } },
	required: ['id'],
	patternProperties: { '^x-': { type: 'number' } },
	additionalProperties: false,
};

const mappedKeys: TestSchema = {
	type: 'object',
	propertyNames: { $ref: '#/$defs/Weekday' },
	properties: { monday: { type: 'number' } },
	required: ['monday'],
	patternProperties: { '^applies_to_(foo|bar)$': { type: 'string' } },
	additionalProperties: { type: 'number' },
	$defs: {
		Weekday: { type: 'string', enum: ['monday', 'tuesday'] },
	},
};

const patternKeys: TestSchema = {
	type: 'object',
	additionalProperties: false,
	patternProperties: {
		'^x-': { type: 'number' },
		'applies_to_(foo|bar)': { type: 'string' },
	},
};

const constants: TestSchema = {
	type: 'object',
	properties: {
		point: { const: { kind: 'point', values: [1, 2] } },
		status: { enum: ['open', 'closed'] },
		anything: { enum: ['mixed', 1, true, null] },
	},
	additionalProperties: false,
};

const requiredWithoutProperty: TestSchema = {
	type: 'object',
	required: ['value'],
	additionalProperties: { type: 'number' },
};

const tuples: TestSchema = {
	type: 'object',
	properties: {
		closedPair: {
			type: 'array',
			prefixItems: [{ type: 'string' }, { type: 'number' }],
			items: false,
		} as TestSchema,
		openTuple: {
			type: 'array',
			prefixItems: [{ type: 'string' }],
		} as TestSchema,
	},
	additionalProperties: false,
};

const intersections: TestSchema = {
	type: 'object',
	properties: { id: { type: 'string' } },
	required: ['id'],
	allOf: [
		{ $ref: '#/$defs/Named' },
		{ type: 'object', properties: { age: { type: 'number' } }, required: ['age'] },
	],
	additionalProperties: false,
	$defs: {
		Named: {
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name'],
		},
	},
};

const booleanDefinitions = {
	type: 'object',
	properties: { allowed: { $ref: '#/$defs/Allowed' } },
	$defs: { Allowed: true, Denied: false },
} as TestSchema;

const shadowedGlobals = {
	title: 'Array',
	type: 'object',
	properties: { empty: { $ref: '#/$defs/Record' } },
	$defs: { Record: { title: 'Record', const: {} } },
} as TestSchema;

const siblingConstrainedUnion: TestSchema = {
	type: 'object',
	properties: { id: { type: 'string' } },
	required: ['id'],
	additionalProperties: false,
	anyOf: [
		{
			type: 'object',
			properties: { kind: { const: 'a' } },
			required: ['kind'],
			additionalProperties: false,
		},
		{
			type: 'object',
			properties: { kind: { const: 'b' } },
			required: ['kind'],
			additionalProperties: false,
		},
	],
};

describe('generated types type-check', () => {
	test('accepts strict TypeScript', async () => {
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
				'Unions.ts': unions,
				'TypedAdditionalProperties.ts': typedAdditionalProperties,
				'Patterns.ts': patterns,
				'MappedKeys.ts': mappedKeys,
				'PatternKeys.ts': patternKeys,
				'Constants.ts': constants,
				'RequiredWithoutProperty.ts': requiredWithoutProperty,
				'Tuples.ts': tuples,
				'Intersections.ts': intersections,
				'BooleanDefinitions.ts': booleanDefinitions,
				'ShadowedGlobals.ts': shadowedGlobals,
				'SiblingConstrainedUnion.ts': siblingConstrainedUnion,
			})
		).resolves.toBeUndefined();
	});
});

async function typeCheck(schemas: Record<string, TestSchema>) {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const files: string[] = [];

	try {
		for (const [name, schema] of Object.entries(schemas)) {
			const code = await compile(schema);
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
			const output = commandOutput(error);

			throw new Error(`tsc failed:\n${output.stdout}${output.stderr}`, {
				cause: error,
			});
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
