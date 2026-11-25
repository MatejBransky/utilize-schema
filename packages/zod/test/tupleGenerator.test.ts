import { resolveDialect } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { generator } from '../src/generators/tupleGenerator';
import type { GeneratorContext } from '../src/generators/types';

const draft07 = 'http://json-schema.org/draft-07/schema#';
const twentyTwentyTwelve = 'https://json-schema.org/draft/2020-12/schema';

function contextFor(dialect: string): GeneratorContext {
	return {
		lazyRefs: new Set(),
		nameOf: () => 'Tuple',
		dialect: resolveDialect({ $schema: dialect }).dialect,
	};
}

const recursion = {
	generateSchema(schema: ParsedJSONSchema | undefined): string {
		return schema && typeof schema === 'object' && schema.type === 'number'
			? 'z.number()'
			: 'z.string()';
	},
	selectGenerator() {
		throw new Error('Unexpected generator selection');
	},
};

function generate(schema: unknown, dialect = draft07): string {
	return generator.generate(schema as ParsedJSONSchemaObject, contextFor(dialect), recursion);
}

describe('tuple generator', () => {
	test('makes only items beyond minItems optional', () => {
		const code = generate({
			type: 'array',
			items: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
			minItems: 2,
		});

		expect(code.match(/\.optional\(\)/g)).toHaveLength(1);
		expect(code).toContain('z.string()');
		expect(code).toContain('z.number()');
	});

	test('renders a rest schema when one is available', () => {
		const code = generate({
			type: 'array',
			items: [{ type: 'string' }],
			additionalItems: { type: 'number' },
		});

		expect(code).toContain('.rest(z.number())');
	});

	test('adds refinements when tuple bounds exceed the fixed items', () => {
		const code = generate({
			type: 'array',
			items: [{ type: 'string' }],
			minItems: 3,
			maxItems: 5,
		});

		expect(code).toContain('value.length >= 3');
		expect(code).toContain('value.length <= 5');
	});

	test('supports 2020-12 prefixItems with a false rest schema', () => {
		const code = generate(
			{
				type: 'array',
				prefixItems: [{ type: 'string' }, { type: 'number' }],
				items: false,
				maxItems: 2,
			},
			twentyTwentyTwelve
		);

		expect(code).toContain('z.string()');
		expect(code).toContain('z.number()');
		expect(code).not.toContain('.rest(');
		expect(code).not.toContain('.refine(');
	});
});
