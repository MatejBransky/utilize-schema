import type { JSONSchema } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { generateCode } from './test-utils';
import type { TestCompileOptions } from './test-utils';

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

const cycleNode: JSONSchema = {
	type: 'object',
	properties: { next: { $ref: '#/definitions/Wrapper' } },
};

/** The inline copy of `Node` becomes a reference that closes a cycle. */
const inlineCopyCycleSchema: JSONSchema = {
	type: 'object',
	properties: { wrapper: { $ref: '#/definitions/Wrapper' } },
	definitions: {
		Node: cycleNode,
		Wrapper: { type: 'object', properties: { node: structuredClone(cycleNode) } },
	},
};

/** draft-07 ignores the `type` and `const` next to `$ref`, so only `Kind` applies. */
const refWithIgnoredLiteralSchema: JSONSchema = {
	type: 'object',
	properties: {
		kind: { $ref: '#/definitions/Kind', type: 'string', const: 'a' } as JSONSchema,
		next: { $ref: '#' },
	},
	definitions: { Kind: { type: 'string' } },
};

/** draft-07 ignores a `const` or `allOf` next to `$ref` with another sibling too (issue 88). */
const refWithIgnoredCombinatorSchema: JSONSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	properties: {
		kind: { $ref: '#/definitions/Kind', const: 'a', minLength: 1 } as JSONSchema,
		tag: { $ref: '#/definitions/Kind', allOf: [{ const: 'b' }], type: 'string' } as JSONSchema,
		next: { $ref: '#' },
	},
	definitions: { Kind: { type: 'string' } },
};

/** 2019-09 applies the keywords next to `$ref`, so the value type keeps them. */
const refWithAppliedCombinatorSchema = {
	$schema: 'https://json-schema.org/draft/2019-09/schema',
	type: 'object',
	properties: {
		kind: { $ref: '#/$defs/Kind', const: 'a', minLength: 1 },
		next: { $ref: '#' },
	},
	$defs: { Kind: { type: 'string' } },
} as unknown as JSONSchema;

/** Both arrays of the recursive schema are hoisted into one declaration. */
const hoistedCycleSchema: JSONSchema = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		left: { type: 'array', items: { $ref: '#' } },
		right: { type: 'array', items: { $ref: '#' } },
	},
	required: ['name'],
};

/** The hoisted arrays sit in records, so the cycle is broken with `z.lazy()`. */
const hoistedLazyCycleSchema: JSONSchema = {
	type: 'array',
	items: [
		{ type: 'object', additionalProperties: { type: 'array', items: { $ref: '#' } } },
		{ type: 'object', additionalProperties: { type: 'array', items: { $ref: '#' } } },
	],
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
				'InlineCopyCycle.ts': inlineCopyCycleSchema,
				'RefWithIgnoredLiteral.ts': refWithIgnoredLiteralSchema,
				'RefWithIgnoredCombinator.ts': refWithIgnoredCombinatorSchema,
				'RefWithAppliedCombinator.ts': refWithAppliedCombinatorSchema,
				'HoistedCycle.ts': hoistedCycleSchema,
				'HoistedLazyCycle.ts': hoistedLazyCycleSchema,
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

	test('type-check formats mapped by formatMap', async () => {
		await expect(
			typeCheck(
				{
					'Constrained.ts': {
						type: 'string',
						format: 'phone-number',
						minLength: 3,
						maxLength: 9,
						pattern: '^1',
					},
					'BuiltInOverride.ts': { type: 'string', format: 'email', minLength: 5 },
					'Nullable.ts': { type: ['string', 'null'], format: 'phone-number' },
					'Annotated.ts': {
						type: 'string',
						format: 'date-time',
						title: 'Timestamp',
						default: '2020-01-01T00:00:00Z',
						readOnly: true,
					},
					'Untyped.ts': { format: 'phone-number', default: '123-4567' },
					'Unknown.ts': { type: 'string', format: 'not-mapped' },
					'RecursiveObject.ts': {
						type: 'object',
						properties: {
							phone: { type: 'string', format: 'phone-number', minLength: 1 },
							children: { type: 'array', items: { $ref: '#' } },
						},
					},
					'RecursiveLazy.ts': {
						type: 'array',
						items: { anyOf: [{ type: 'string', format: 'email' }, { $ref: '#' }] },
					},
				},
				{
					readOnlyKeyword: true,
					formatMap: {
						'phone-number': String.raw`z.string().regex(/^\d{3}-\d{4}$/)`,
						email: 'z.email()',
						'date-time': 'z.iso.datetime({ offset: true })',
					},
				}
			)
		).resolves.toBeUndefined();
	});

	test('type-check nodes replaced by customSchemaResolver', async () => {
		await expect(
			typeCheck(
				{
					'Plain.ts': { type: 'object', properties: { created: dateTime } },
					'RecursiveObject.ts': {
						type: 'object',
						properties: {
							created: dateTime,
							children: { type: 'array', items: { $ref: '#' } },
						},
						required: ['created'],
					},
					'RecursiveTypeList.ts': {
						type: 'object',
						properties: {
							created: { ...dateTime, type: ['string', 'null'] },
							next: { $ref: '#' },
						},
					},
					'ReplacedReference.ts': {
						type: 'object',
						properties: { children: { type: 'array', items: { $ref: '#', title: 'Child' } } },
					},
					'ReplacedRecursiveRoot.ts': {
						type: 'object',
						title: 'Replaced',
						properties: { children: { type: 'array', items: { $ref: '#' } } },
					},
				},
				{
					customSchemaResolver: (schema) =>
						schema.type === 'string' && schema.format === 'date-time'
							? 'z.coerce.date()'
							: schema.title === 'Child'
								? 'z.number()'
								: schema.title === 'Replaced'
									? 'z.string()'
									: undefined,
				}
			)
		).resolves.toBeUndefined();
	});
});

describe('value types of $ref siblings', () => {
	test('draft-07 renders only the reference', async () => {
		await expect(generateCode(refWithIgnoredCombinatorSchema)).resolves.toContain(
			'type RootValue = { kind?: Kind; tag?: Kind; next?: RootValue };'
		);
	});

	test('2019-09 intersects the reference with its siblings', async () => {
		await expect(generateCode(refWithAppliedCombinatorSchema)).resolves.toContain(
			"type RootValue = { kind?: Kind & ('a' & unknown); next?: RootValue };"
		);
	});
});

const dateTime: JSONSchema = { type: 'string', format: 'date-time' };

async function typeCheck(schemas: Record<string, JSONSchema>, options: TestCompileOptions = {}) {
	const directory = await mkdtemp(join(__dirname, '__generated__-'));
	const files: string[] = [];

	try {
		for (const [name, schema] of Object.entries(schemas)) {
			const code = await generateCode(schema, { importZod: true, ...options });
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
