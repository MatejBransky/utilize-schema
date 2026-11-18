import { type JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { compile, type CompileOptions } from './test-utils';

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

const allOfSchema: JSONSchema = {
	allOf: [
		{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
		{ type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
		{ type: 'object', properties: { c: { type: 'boolean' } }, required: ['c'] },
	],
};

const notSchema: JSONSchema = {
	type: 'string',
	not: { const: 'forbidden' },
};

const ifThenElseSchema: JSONSchema = {
	type: 'object',
	properties: {
		country: { type: 'string' },
		postal: { type: 'string' },
	},
	required: ['country'],
	if: {
		properties: { country: { const: 'US' } },
		required: ['country'],
	},
	then: {
		properties: { postal: { pattern: '^[0-9]{5}$' } },
		required: ['postal'],
	},
	else: {
		properties: { postal: { minLength: 3 } },
	},
};

const containsSchema: JSONSchema = {
	type: 'array',
	contains: { type: 'number' },
};

const propertyNamesSchema: JSONSchema = {
	type: 'object',
	additionalProperties: true,
	propertyNames: { pattern: '^[a-z]+$' },
};

const dependenciesSchema: JSONSchema = {
	type: 'object',
	properties: {
		a: { type: 'string' },
		b: { type: 'string' },
	},
	dependencies: {
		a: ['b'],
		b: { required: ['a'] },
	},
};

const examplesSchema: JSONSchema = {
	type: 'string',
	examples: ['a', 'b'],
};

const prefixItemsSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'array',
	prefixItems: [{ type: 'string' }],
	items: { type: 'number' },
} as unknown as JSONSchema;

const dependentRequiredSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	type: 'object',
	properties: {
		a: { type: 'string' },
		b: { type: 'string' },
	},
	dependentRequired: { a: ['b'] },
} as unknown as JSONSchema;

const draft04ExclusiveSchema = {
	$schema: 'http://json-schema.org/draft-04/schema#',
	type: 'number',
	minimum: 0,
	exclusiveMinimum: true,
} as unknown as JSONSchema;

const siblingAllOfSchema: JSONSchema = {
	allOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }],
	properties: { b: { type: 'number' } },
	required: ['b'],
};

const siblingAnyOfSchema: JSONSchema = {
	type: 'string',
	anyOf: [{ minLength: 2 }, { maxLength: 4 }],
};

const booleanRefSchema = {
	type: 'object',
	properties: {
		allowed: { $ref: '#/$defs/allowed' },
		denied: { $ref: '#/$defs/denied' },
	},
	$defs: { allowed: true, denied: false },
} as unknown as JSONSchema;

const patternPropertiesSchema: JSONSchema = {
	type: 'object',
	patternProperties: { '^a': { type: 'string' } },
	additionalProperties: false,
};

const recursivePatternPropertiesSchema: JSONSchema = {
	type: 'object',
	properties: { name: { type: 'string' } },
	patternProperties: { '^x-': { $ref: '#' } },
	additionalProperties: { type: 'integer' },
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
				'AllOf.ts': allOfSchema,
				'Not.ts': notSchema,
				'IfThenElse.ts': ifThenElseSchema,
				'Contains.ts': containsSchema,
				'PropertyNames.ts': propertyNamesSchema,
				'Dependencies.ts': dependenciesSchema,
				'Examples.ts': examplesSchema,
				'PrefixItems.ts': prefixItemsSchema,
				'DependentRequired.ts': dependentRequiredSchema,
				'Draft04Exclusive.ts': draft04ExclusiveSchema,
				'SiblingAllOf.ts': siblingAllOfSchema,
				'SiblingAnyOf.ts': siblingAnyOfSchema,
				'BooleanRef.ts': booleanRefSchema,
				'PatternProperties.ts': patternPropertiesSchema,
				'RecursivePatternProperties.ts': recursivePatternPropertiesSchema,
			})
		).resolves.toBeUndefined();
	});

	test('type-check mapped schema and type names', async () => {
		await expect(
			typeCheck(
				{
					'Tree.ts': treeSchema,
					'MutualDefs.ts': mutualDefsSchema,
					'AllOf.ts': allOfSchema,
				},
				{ schemaName: (name) => `${name}Schema` }
			)
		).resolves.toBeUndefined();
	});
});

async function typeCheck(schemas: Record<string, JSONSchema>, options: CompileOptions = {}) {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const files: string[] = [];

	try {
		for (const [name, schema] of Object.entries(schemas)) {
			const code = await compile(schema, { importZod: true, ...options });
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
