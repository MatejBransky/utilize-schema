import { describe, expect, test } from 'vitest';

import {
	Intersection,
	link,
	type JSONSchema,
	type JSONSchemaType,
	type LinkedJSONSchema,
} from '../src';
import { traverse } from '../src/traverse';

interface VisitedSchema {
	key: string | null;
	type?: JSONSchemaType;
}

type SubSchemaTestCase = {
	state?: 'skip' | 'todo' | 'only';
	title: string;
	expected: VisitedSchema[];
} & (
	| { schema: JSONSchema; linkedSchema?: undefined }
	| { schema?: undefined; linkedSchema: () => LinkedJSONSchema }
);

describe('traverse() visits all subschemas', () => {
	const testCases: SubSchemaTestCase[] = [
		{
			title: 'calls callback for root and all nested schemas',
			schema: {
				type: 'object',
				properties: {
					foo: { type: 'string' },
					bar: { type: 'number' },
				},
				required: ['foo'],
			},
			expected: [
				{ key: null, type: 'object' }, // root
				{ key: 'foo', type: 'string' },
				{ key: 'bar', type: 'number' },
			],
		},
		{
			title: 'visits all subschemas in anyOf',
			schema: {
				anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
			},
			expected: [
				{ key: null, type: undefined }, // root
				{ key: '0', type: 'string' },
				{ key: '1', type: 'number' },
				{ key: '2', type: 'boolean' },
			],
		},
		{
			title: 'visits all subschemas in allOf',
			schema: {
				allOf: [{ type: 'string' }, { type: 'number' }],
			},
			expected: [
				{ key: null, type: undefined }, // root
				{ key: '0', type: 'string' },
				{ key: '1', type: 'number' },
			],
		},
		{
			title: 'visits all subschemas in oneOf',
			schema: {
				oneOf: [{ type: 'string' }, { type: 'number' }],
			},
			expected: [
				{ key: null, type: undefined }, // root
				{ key: '0', type: 'string' },
				{ key: '1', type: 'number' },
			],
		},
		{
			title: 'visits all tuple items in items array',
			schema: {
				type: 'array',
				items: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
			},
			expected: [
				{ key: null, type: 'array' }, // root
				{ key: '0', type: 'string' },
				{ key: '1', type: 'number' },
				{ key: '2', type: 'boolean' },
			],
		},
		{
			title: 'visits all patternProperties',
			schema: {
				type: 'object',
				patternProperties: {
					'^foo': { type: 'string' },
					'^bar': { type: 'number' },
				},
			},
			expected: [
				{ key: null, type: 'object' },
				{ key: '^foo', type: 'string' },
				{ key: '^bar', type: 'number' },
			],
		},
		{
			state: 'skip',
			title: 'visits additionalProperties when it is a schema',
			schema: {
				type: 'object',
				additionalProperties: { type: 'boolean' },
			},
			expected: [
				{ key: null, type: 'object' },
				{ key: 'additionalProperties', type: 'boolean' },
			],
		},
		{
			state: 'skip',
			title: 'visits not schema',
			schema: {
				not: { type: 'string' },
			},
			expected: [
				{ key: null, type: undefined },
				{ key: 'not', type: 'string' },
			],
		},
		{
			title: 'visits all definitions',
			schema: {
				definitions: {
					foo: { type: 'string' },
					bar: { type: 'number' },
				},
			},
			expected: [
				{ key: null, type: undefined },
				{ key: 'foo', type: 'string' },
				{ key: 'bar', type: 'number' },
			],
		},
		{
			title: 'visits all $defs',
			schema: {
				$defs: {
					foo: { type: 'string' },
					bar: { type: 'number' },
				},
			},
			expected: [
				{ key: null, type: undefined },
				{ key: 'foo', type: 'string' },
				{ key: 'bar', type: 'number' },
			],
		},
		{
			title: 'visits schema dependencies',
			schema: {
				dependencies: {
					foo: { type: 'string' },
					bar: { type: 'number' },
				},
			},
			expected: [
				{ key: null, type: undefined },
				{ key: 'foo', type: 'string' },
				{ key: 'bar', type: 'number' },
			],
		},
		{
			state: 'skip',
			title: 'visits additionalItems when it is a schema',
			schema: {
				type: 'array',
				items: [{ type: 'string' }],
				additionalItems: { type: 'number' },
			},
			expected: [
				{ key: null, type: 'array' },
				{ key: '0', type: 'string' },
				{ key: 'additionalItems', type: 'number' },
			],
		},
		{
			title: 'visits allOf in intersection schema',
			linkedSchema: () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const intersectionSchema: any = {
					type: 'object',
					properties: {
						foo: { type: 'string' },
					},
				};
				intersectionSchema[Intersection] = {
					allOf: [{ type: 'string' }, { type: 'number' }],
				};
				return intersectionSchema;
			},
			expected: [
				{ key: null, type: 'object' }, // root
				{ key: 'foo', type: 'string' },
				{ key: '0', type: 'string' },
				{ key: '1', type: 'number' },
			],
		},
	];

	testCases.forEach((testCase) => {
		const testMethod = testCase.state ? test[testCase.state] : test;
		testMethod(testCase.title, () => {
			const visited: VisitedSchema[] = [];
			const linkedSchema = testCase.linkedSchema
				? testCase.linkedSchema()
				: link(testCase.schema);

			traverse({
				schema: linkedSchema,
				callback: (subschema, key) => {
					visited.push({ key, type: subschema.type });
				},
			});

			expect(visited).toEqual(testCase.expected);
		});
	});
});
