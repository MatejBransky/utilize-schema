import type { JSONSchema } from '../../src';

export const input: JSONSchema = {
	title: 'Example Schema',
	type: 'object',
	properties: {
		firstName: {
			type: 'string',
		},
		lastName: {
			$id: 'lastName',
			type: 'string',
		},
		age: {
			description: 'Age in years',
			type: 'integer',
			minimum: 0,
		},
		height: {
			$id: 'height',
			type: 'number',
		},
		favoriteFoods: {
			type: 'array',
		},
		likesDogs: {
			type: 'boolean',
		},
		gender: { $ref: '#/definitions/Gender' },
	},
	required: ['firstName', 'lastName'],
	definitions: {
		Gender: {
			enum: ['man', 'woman'],
		},
	},
};
