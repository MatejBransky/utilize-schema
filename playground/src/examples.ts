import type { SchemaFile } from './bundle';

export interface Example {
	id: string;
	name: string;
	group: string;
	files: SchemaFile[];
}

function jsonFile(id: string, name: string, schema: unknown): SchemaFile {
	return { id, name, content: JSON.stringify(schema, null, 2) };
}

function draft07(schema: Record<string, unknown>): Record<string, unknown> {
	return { $schema: 'http://json-schema.org/draft-07/schema#', ...schema };
}

function single(id: string, name: string, group: string, schema: Record<string, unknown>): Example {
	return {
		id,
		name,
		group,
		files: [jsonFile(id, `${id}.json`, draft07(schema))],
	};
}

export const examples: Example[] = [
	single('enum', 'Enum', 'Basics', {
		title: 'Color',
		enum: ['red', 'green', 'blue'],
	}),
	single('const', 'Const', 'Basics', {
		title: 'Answer',
		const: 42,
	}),
	single('object', 'Object', 'Basics', {
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
	}),
	single('union', 'Union', 'Basics', {
		title: 'Id',
		anyOf: [{ type: 'string' }, { type: 'number' }],
	}),
	single('array', 'Array', 'Basics', {
		title: 'Tags',
		type: 'array',
		items: { type: 'string' },
		minItems: 1,
		maxItems: 5,
	}),
	single('tuple', 'Tuple', 'Basics', {
		title: 'Point',
		type: 'array',
		items: [{ type: 'number' }, { type: 'number' }],
		additionalItems: { type: 'number' },
	}),
	single('constraints', 'Constraints', 'Common', {
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
	}),
	single('defaults', 'Defaults', 'Common', {
		title: 'Settings',
		type: 'object',
		properties: {
			theme: { type: 'string', default: 'auto' },
			pageSize: { type: 'integer', default: 20 },
			search: { type: 'string' },
		},
	}),
	single('record', 'Record', 'Common', {
		title: 'Scores',
		type: 'object',
		additionalProperties: { type: 'number' },
	}),
	single('all-of', 'All of', 'Common', {
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
	}),
	single('one-of', 'One of', 'Advanced', {
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
	}),
	single('discriminator', 'Discriminator', 'Advanced', {
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
	}),
	single('conditions', 'Conditions', 'Advanced', {
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
	}),
	single('dependencies', 'Dependencies', 'Advanced', {
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
	}),
	single('contains', 'Contains & property names', 'Advanced', {
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
	}),
	single('not', 'Not', 'Advanced', {
		title: 'Slug',
		type: 'string',
		not: { enum: ['admin', 'api'] },
	}),
	single('local-ref', 'Local $ref', 'References', {
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
	}),
	single('recursion', 'Recursion', 'References', {
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
	}),
	single('recursive-one-of', 'Recursive oneOf', 'References', {
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
	}),
	single('id-refs', '$id and $anchor refs', 'References', {
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
	}),
	single('pattern-properties', 'Pattern properties', 'Common', {
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
	}),
	single('external-ref', 'External $ref', 'References', {
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
	}),
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
	},
];

export const defaultExampleId = 'multi-file';

export function exampleById(id: string | null): Example | undefined {
	return examples.find((example) => example.id === id);
}
