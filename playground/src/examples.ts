import type { JSONSchema } from '@utilize/json-schema';

import type { SchemaFile } from './bundle';

export interface ExampleCase {
	value: string;
	label: string;
	expect: 'valid' | 'invalid';
	data: unknown;
}

export interface Example {
	id: string;
	name: string;
	group: string;
	files: SchemaFile[];
	cases: ExampleCase[];
}

function jsonFile(id: string, name: string, schema: unknown): SchemaFile {
	return { id, name, content: JSON.stringify(schema, null, 2) };
}

function draft07(schema: JSONSchema): JSONSchema {
	return { $schema: 'http://json-schema.org/draft-07/schema#', ...schema };
}

function valid(data: unknown, label = 'Valid', value = 'valid'): ExampleCase {
	return { value, label, expect: 'valid', data };
}

function invalid(data: unknown): ExampleCase {
	return { value: 'invalid', label: 'Invalid', expect: 'invalid', data };
}

function single(
	id: string,
	name: string,
	group: string,
	schema: JSONSchema,
	cases: ExampleCase[]
): Example {
	return {
		id,
		name,
		group,
		files: [jsonFile(id, `${id}.json`, draft07(schema))],
		cases,
	};
}

export const examples: Example[] = [
	single(
		'enum',
		'Enum',
		'Basics',
		{
			title: 'Color',
			enum: ['red', 'green', 'blue'],
		},
		[valid('green'), invalid('purple')]
	),
	single(
		'const',
		'Const',
		'Basics',
		{
			title: 'Answer',
			const: 42,
		},
		[valid(42), invalid(41)]
	),
	single(
		'const-object',
		'Const object',
		'Basics',
		{
			title: 'Point',
			const: { x: 1, y: 2 },
		},
		[valid({ x: 1, y: 2 }), invalid({ x: 1, y: 3 })]
	),
	single(
		'object',
		'Object',
		'Basics',
		{
			title: 'Person',
			type: 'object',
			properties: {
				name: { type: 'string' },
				age: { type: 'integer' },
				developer: { type: 'boolean' },
				nickname: { type: ['string', 'null'] },
			},
			required: ['name', 'age', 'developer', 'nickname'],
			additionalProperties: false,
		},
		[
			valid({ name: 'Ada Lovelace', age: 36, developer: true, nickname: null }),
			invalid({ name: 'Ada Lovelace' }),
		]
	),
	single(
		'union',
		'Union',
		'Basics',
		{
			title: 'Id',
			anyOf: [{ type: 'string' }, { type: 'number' }],
		},
		[valid('order_1234'), invalid(true)]
	),
	single(
		'array',
		'Array',
		'Basics',
		{
			title: 'Tags',
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
			maxItems: 5,
		},
		[valid(['json', 'schema']), invalid([])]
	),
	single(
		'tuple',
		'Tuple',
		'Basics',
		{
			title: 'Point',
			type: 'array',
			items: [{ type: 'number' }, { type: 'number' }],
			additionalItems: { type: 'number' },
		},
		[valid([10, 20, 30]), invalid([10, 'twenty'])]
	),
	single(
		'constraints',
		'Constraints',
		'Common',
		{
			title: 'Account',
			type: 'object',
			properties: {
				username: {
					type: 'string',
					minLength: 3,
					maxLength: 20,
					pattern: '^[a-z0-9_]+$',
				},
				email: { type: 'string', format: 'email' },
				age: { type: 'integer', minimum: 13, maximum: 120 },
				score: {
					type: 'number',
					exclusiveMinimum: 0,
					exclusiveMaximum: 1,
					multipleOf: 0.5,
				},
			},
			required: ['username', 'email', 'age', 'score'],
		},
		[
			valid({ username: 'ada_lovelace', email: 'ada@example.com', age: 36, score: 0.5 }),
			invalid({ username: 'A', email: 'not-an-email', age: 12, score: 1 }),
		]
	),
	single(
		'defaults',
		'Defaults',
		'Common',
		{
			title: 'Settings',
			type: 'object',
			properties: {
				theme: { type: 'string', default: 'auto' },
				pageSize: { type: 'integer', default: 20 },
				search: { type: 'string' },
			},
		},
		[valid({ pageSize: 25 }), invalid({ pageSize: 'many' })]
	),
	single(
		'record',
		'Record',
		'Common',
		{
			title: 'Scores',
			type: 'object',
			additionalProperties: { type: 'number' },
		},
		[valid({ ada: 10, grace: 9.5 }), invalid({ ada: 'high' })]
	),
	single(
		'all-of-scalar',
		'Scalar allOf',
		'Advanced',
		{
			title: 'Score',
			allOf: [{ minimum: 20 }, { maximum: 30 }],
		},
		[valid(25), invalid(35)]
	),
	single(
		'all-of-ref-filter',
		'All of with $ref and if',
		'Advanced',
		{
			title: 'Port',
			allOf: [{ $ref: '#/definitions/port' }],
			if: { maximum: 65_535 },
			then: { minimum: 1 },
			definitions: {
				port: { type: 'integer' },
			},
		},
		[valid(443), invalid(0)]
	),
	single(
		'all-of-additional-properties',
		'All of and additionalProperties',
		'Advanced',
		{
			title: 'Flags',
			allOf: [{ properties: { label: {} } }],
			additionalProperties: { type: 'boolean' },
		},
		[valid({ active: true }), invalid({ active: 'yes' })]
	),
	single(
		'any-of-base',
		'anyOf with base schema',
		'Advanced',
		{
			title: 'Code',
			type: 'string',
			anyOf: [{ maxLength: 2 }, { minLength: 4 }],
		},
		[valid('ok'), invalid('abc')]
	),
	single(
		'untyped-contains',
		'Contains without a type',
		'Advanced',
		{
			title: 'Tags',
			contains: { const: 'featured' },
		},
		[valid(['featured', 'json']), invalid(['json'])]
	),
	single(
		'all-of',
		'All of',
		'Common',
		{
			title: 'Employee',
			allOf: [
				{
					type: 'object',
					properties: { name: { type: 'string' } },
					required: ['name'],
				},
				{
					type: 'object',
					properties: { role: { type: 'string' } },
					required: ['role'],
				},
				{
					type: 'object',
					properties: { active: { type: 'boolean' } },
					required: ['active'],
				},
			],
		},
		[
			valid({ name: 'Ada Lovelace', role: 'admin', active: true }),
			invalid({ name: 'Ada Lovelace' }),
		]
	),
	single(
		'one-of',
		'One of',
		'Advanced',
		{
			title: 'Shape',
			oneOf: [
				{
					type: 'object',
					properties: {
						kind: { const: 'circle' },
						radius: { type: 'number' },
					},
					required: ['kind', 'radius'],
				},
				{
					type: 'object',
					properties: {
						kind: { const: 'square' },
						size: { type: 'number' },
					},
					required: ['kind', 'size'],
				},
			],
		},
		[valid({ kind: 'circle', radius: 2 }), invalid({ kind: 'circle', size: 2 })]
	),
	single(
		'discriminator',
		'Discriminator',
		'Advanced',
		{
			title: 'Shape',
			oneOf: [
				{
					type: 'object',
					properties: {
						kind: { const: 'circle' },
						radius: { type: 'number' },
					},
					required: ['kind', 'radius'],
				},
				{
					type: 'object',
					properties: {
						kind: { const: 'square' },
						size: { type: 'number' },
					},
					required: ['kind', 'size'],
				},
			],
			discriminator: 'kind',
		},
		[valid({ kind: 'square', size: 4 }), invalid({ kind: 'triangle', size: 4 })]
	),
	single(
		'conditions',
		'Conditions',
		'Advanced',
		{
			title: 'Address',
			type: 'object',
			properties: {
				country: { type: 'string' },
				postalCode: { type: 'string' },
			},
			if: {
				properties: { country: { const: 'US' } },
				required: ['country'],
			},
			then: {
				properties: { postalCode: { pattern: '^[0-9]{5}$' } },
				required: ['postalCode'],
			},
			else: {
				properties: { postalCode: { minLength: 3 } },
			},
		},
		[valid({ country: 'US', postalCode: '94107' }), invalid({ country: 'US', postalCode: '94' })]
	),
	single(
		'dependencies',
		'Dependencies',
		'Advanced',
		{
			title: 'Payment',
			type: 'object',
			properties: {
				card: { type: 'string' },
				billingAddress: { type: 'string' },
				coupon: { type: 'string' },
			},
			dependencies: {
				card: ['billingAddress'],
				coupon: {
					properties: { card: { type: 'string' } },
					required: ['card'],
				},
			},
		},
		[valid({ card: '4242 4242', billingAddress: '1 Main St' }), invalid({ card: '4242 4242' })]
	),
	single(
		'contains',
		'Contains & property names',
		'Advanced',
		{
			title: 'Catalog',
			type: 'object',
			properties: {
				tags: {
					type: 'array',
					items: { type: 'string' },
					contains: { const: 'featured' },
				},
			},
			additionalProperties: { type: 'string' },
			propertyNames: { pattern: '^[a-z]+$' },
		},
		[valid({ tags: ['featured', 'json'], note: 'catalog' }), invalid({ tags: ['json'] })]
	),
	single(
		'min-contains',
		'minContains and maxContains',
		'Advanced',
		{
			$schema: 'https://json-schema.org/draft/2020-12/schema',
			title: 'Tags',
			type: 'array',
			items: { type: 'string' },
			contains: { const: 'featured' },
			minContains: 2,
			maxContains: 3,
		},
		[valid(['featured', 'featured', 'json']), invalid(['featured', 'json'])]
	),
	single(
		'unicode-pattern',
		'Unicode pattern',
		'Advanced',
		{
			title: 'Word',
			type: 'string',
			pattern: String.raw`^\p{Letter}+$`,
		},
		[valid('Český'), invalid('abc123')]
	),
	single(
		'not',
		'Not',
		'Advanced',
		{
			title: 'Slug',
			type: 'string',
			not: { enum: ['admin', 'api'] },
		},
		[valid('hello-world'), invalid('admin')]
	),
	single(
		'root-ref',
		'Root $ref',
		'References',
		{
			title: 'Alias',
			definitions: {
				name: { title: 'Name', type: 'string' },
			},
			$ref: '#/definitions/name',
		},
		[valid('Ada Lovelace'), invalid(42)]
	),
	single(
		'local-ref',
		'Local $ref',
		'References',
		{
			title: 'Order',
			type: 'object',
			properties: {
				customer: { $ref: '#/definitions/Customer' },
				items: {
					type: 'array',
					items: { $ref: '#/definitions/Item' },
				},
			},
			required: ['customer', 'items'],
			definitions: {
				Customer: {
					title: 'Customer',
					type: 'object',
					properties: { id: { type: 'string' } },
					required: ['id'],
				},
				Item: {
					title: 'Item',
					type: 'object',
					properties: { sku: { type: 'string' } },
					required: ['sku'],
				},
			},
		},
		[
			valid({ customer: { id: 'c_1' }, items: [{ sku: 'A-1' }] }),
			invalid({ customer: {}, items: [{ sku: 'A-1' }] }),
		]
	),
	single(
		'recursion',
		'Recursion',
		'References',
		{
			title: 'Tree',
			type: 'object',
			properties: {
				name: { type: 'string' },
				children: {
					type: 'array',
					items: { $ref: '#/definitions/Tree' },
				},
			},
			required: ['name'],
			definitions: {
				Tree: {
					title: 'Tree',
					type: 'object',
					properties: {
						name: { type: 'string' },
						children: {
							type: 'array',
							items: { $ref: '#/definitions/Tree' },
						},
					},
					required: ['name'],
				},
			},
		},
		[
			valid({ name: 'root', children: [{ name: 'leaf', children: [] }] }),
			invalid({ name: 'root', children: [{ children: [] }] }),
		]
	),
	single(
		'recursive-one-of',
		'Recursive oneOf',
		'References',
		{
			title: 'Filter',
			oneOf: [
				{
					type: 'object',
					properties: {
						type: { const: 'Id' },
						search: { type: 'string' },
					},
					required: ['type', 'search'],
				},
				{
					type: 'object',
					properties: {
						type: { const: 'And' },
						filters: { type: 'array', items: { $ref: '#' } },
					},
					required: ['type', 'filters'],
				},
			],
		},
		[
			valid({ type: 'Id', search: 'ada' }, 'Leaf', 'leaf'),
			valid({ type: 'And', filters: [{ type: 'Id', search: 'ada' }] }, 'Nested', 'nested'),
			invalid({ type: 'Or', search: 'ada' }),
		]
	),
	single(
		'id-refs',
		'$id and $anchor refs',
		'References',
		{
			$id: 'https://example.com/person.json',
			title: 'Person',
			type: 'object',
			properties: {
				name: { type: 'string' },
				address: { $ref: '#address' },
			},
			required: ['name', 'address'],
			definitions: {
				address: {
					$id: '#address',
					title: 'Address',
					type: 'object',
					properties: {
						street: { type: 'string' },
						city: { type: 'string' },
					},
					required: ['street', 'city'],
				},
			},
		},
		[
			valid({ name: 'Ada Lovelace', address: { street: '1 Main St', city: 'London' } }),
			invalid({ name: 'Ada Lovelace', address: { street: '1 Main St' } }),
		]
	),
	single(
		'pattern-properties',
		'Pattern properties',
		'Common',
		{
			title: 'Settings',
			type: 'object',
			properties: {
				name: { type: 'string' },
			},
			patternProperties: {
				'^S_': { type: 'string' },
				'^I_': { type: 'integer' },
			},
			additionalProperties: false,
			required: ['name'],
		},
		[
			valid({ name: 'Editor', S_theme: 'dark', I_size: 12 }),
			invalid({ name: 'Editor', S_theme: 12 }),
		]
	),
	single(
		'format-modes',
		'Format modes',
		'Advanced',
		{
			title: 'Contact',
			type: 'object',
			properties: {
				email: { type: 'string', format: 'email' },
				website: { type: 'string', format: 'uri' },
				id: { type: 'string', format: 'uuid' },
				createdAt: { type: 'string', format: 'date-time' },
			},
			required: ['email'],
		},
		[
			valid({
				email: 'ada@example.com',
				website: 'https://example.com',
				id: '123e4567-e89b-12d3-a456-426614174000',
				createdAt: '2026-11-21T10:00:00Z',
			}),
			invalid({ email: 'not-an-email' }),
		]
	),
	single(
		'format-map',
		'Custom format map',
		'Advanced',
		{
			title: 'Phone',
			type: 'string',
			format: 'phone-number',
		},
		[valid('555-1234'), invalid(42)]
	),
	single(
		'formatter-hook',
		'Formatter hook',
		'Advanced',
		{
			title: 'Formatted',
			type: 'object',
			properties: {
				name: { type: 'string' },
			},
		},
		[valid({ name: 'Ada Lovelace' }), invalid({ name: 42 })]
	),
	single(
		'custom-resolver',
		'Custom schema resolver',
		'Advanced',
		{
			title: 'Timestamp',
			type: 'string',
			format: 'date-time',
		},
		[valid('2024-01-01T00:00:00Z'), invalid(42)]
	),
	single(
		'external-ref',
		'External $ref',
		'References',
		{
			title: 'Release',
			type: 'object',
			properties: {
				downloads: {
					$ref: 'https://json-schema.org/draft-07/schema#/definitions/nonNegativeInteger',
				},
				tags: {
					$ref: 'https://json-schema.org/draft-07/schema#/definitions/stringArray',
				},
			},
			required: ['downloads'],
		},
		[valid({ downloads: 10, tags: ['linux', 'mac'] }), invalid({ downloads: -1 })]
	),
	{
		id: 'multi-file',
		name: 'Multi-file refs',
		group: 'References',
		files: [
			jsonFile(
				'person',
				'person.json',
				draft07({
					title: 'Person',
					type: 'object',
					properties: {
						firstName: { type: 'string' },
						lastName: { type: 'string' },
						age: { type: 'integer', minimum: 0 },
						address: { $ref: './address.json' },
						node: { $ref: './node.json' },
						cycle: { $ref: './cycleA.json' },
					},
					additionalProperties: false,
					required: ['firstName', 'lastName'],
				})
			),
			jsonFile(
				'address',
				'address.json',
				draft07({
					title: 'Address',
					type: 'object',
					properties: {
						street: { type: 'string' },
						city: { type: 'string' },
						zip: { type: 'string', pattern: '^[0-9]{5}$' },
					},
					required: ['street', 'city'],
				})
			),
			jsonFile(
				'node',
				'node.json',
				draft07({
					title: 'Node',
					type: 'object',
					properties: {
						value: { type: 'string' },
						children: {
							type: 'array',
							items: { $ref: '#' },
						},
					},
					required: ['value'],
				})
			),
			jsonFile(
				'cycleA',
				'cycleA.json',
				draft07({
					title: 'Cycle A',
					type: 'object',
					properties: {
						name: { type: 'string' },
						b: { $ref: './cycleB.json' },
					},
				})
			),
			jsonFile(
				'cycleB',
				'cycleB.json',
				draft07({
					title: 'Cycle B',
					type: 'object',
					properties: {
						value: { type: 'number' },
						a: {
							anyOf: [{ $ref: './cycleA.json' }, { type: 'null' }],
						},
					},
				})
			),
		],
		cases: [
			valid({
				firstName: 'Ada',
				lastName: 'Lovelace',
				age: 36,
				address: { street: '1 Main St', city: 'London', zip: '12345' },
				node: { value: 'root', children: [{ value: 'leaf' }] },
				cycle: { name: 'a', b: { value: 1, a: null } },
			}),
			invalid({
				firstName: 'Ada',
				lastName: 'Lovelace',
				address: { street: '1 Main St', city: 'London', zip: '12' },
			}),
		],
	},
];

export const defaultExampleId = 'multi-file';

export function exampleById(id: string | null): Example | undefined {
	return examples.find((example) => example.id === id);
}

export function exampleData(example: Example): string {
	return JSON.stringify(example.cases[0]?.data ?? {}, null, 2);
}

export function exampleCaseForData(example: Example, content: string): ExampleCase | undefined {
	let parsed: unknown;

	try {
		parsed = JSON.parse(content);
	} catch {
		return undefined;
	}

	return example.cases.find((item) => JSON.stringify(item.data) === JSON.stringify(parsed));
}
