import { resolveDialect } from '@utilize/json-schema';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { objectGenerator } from '../src/generators/objectGenerator';
import type { GeneratorContext } from '../src/generators/types';

const context: GeneratorContext = {
	lazyRefs: new Set(),
	nameOf: () => 'Object',
	dialect: resolveDialect({ $schema: 'http://json-schema.org/draft-07/schema#' }).dialect,
};

const recursion = {
	generateSchema(schema: ParsedJSONSchema | undefined): string {
		if (!schema || typeof schema !== 'object') {
			return 'z.unknown()';
		}

		const expression =
			schema.type === 'number'
				? 'z.number()'
				: schema.type === 'boolean'
					? 'z.boolean()'
					: 'z.string()';

		return schema.default === undefined
			? expression
			: `${expression}.default(${JSON.stringify(schema.default)})`;
	},
	selectGenerator() {
		throw new Error('Unexpected generator selection');
	},
};

function generate(schema: JSONSchema): string {
	return objectGenerator.generate(schema as ParsedJSONSchemaObject, context, recursion);
}

describe('object generator', () => {
	test('does not mark a property with a default as optional', () => {
		const code = generate({ properties: { count: { type: 'number', default: 0 } } });

		expect(code).toContain('"count": z.number().default(0)');
		expect(code).not.toContain('"count": z.number().default(0).optional()');
	});

	test('adds a refinement for required properties without a declaration', () => {
		const code = generate({ required: ['missing'] });

		expect(code).toContain('.superRefine(');
		expect(code).toContain('Required property is missing.');
	});

	test('selects the object variant from additionalProperties', () => {
		expect(generate({ additionalProperties: false })).toContain('z.strictObject(');
		expect(generate({ additionalProperties: true })).toContain('z.looseObject(');
		expect(generate({ additionalProperties: { type: 'number' } })).toContain(
			'.catchall(z.number())'
		);
	});

	test('uses a loose object and refinement for patternProperties', () => {
		const code = generate({ patternProperties: { '^x_': { type: 'number' } } });

		expect(code).toContain('z.looseObject(');
		expect(code).toContain('.superRefine(');
	});
});
