import { describe, expect, test } from 'vitest';

import { createJsonSchemaValidator } from '../src/runtime';
import { isJSONSchema } from '../src/model';
import type { RuntimeSchemaBundle } from '../src/runtimeSchema';

type SchemaDocument = RuntimeSchemaBundle['documents'][string];
type Dialect = RuntimeSchemaBundle['dialect'];

const ROOT = 'https://schemas.test/root.json';

function validator(
	schema: unknown,
	dialect: Dialect = '2020-12',
	documents: Record<string, SchemaDocument> = {}
) {
	if (!isJSONSchema(schema)) {
		throw new TypeError('Expected a JSON Schema document');
	}

	return createJsonSchemaValidator(
		{
			rootUri: ROOT,
			documents: { [ROOT]: schema, ...documents },
			dialect,
		},
		'annotate'
	);
}

function accepts(schema: unknown, value: unknown, dialect: Dialect = '2020-12'): boolean {
	return validator(schema, dialect)(value, ROOT);
}

describe('validation references', () => {
	test('resolves nested resource ids, anchors, and escaped pointers', () => {
		const validate = validator({
			$id: ROOT,
			$defs: {
				nested: {
					$id: 'nested.json',
					$defs: {
						'a/b~c%d': { $anchor: 'value', type: 'integer' },
					},
				},
			},
			properties: {
				anchor: { $ref: 'nested.json#value' },
				pointer: { $ref: '#/$defs/nested/$defs/a~1b~0c%25d' },
			},
		});

		expect(validate({ anchor: 1, pointer: 2 }, ROOT)).toBe(true);
		expect(validate({ anchor: '1', pointer: 2 }, ROOT)).toBe(false);
		expect(validate({ anchor: 1, pointer: '2' }, ROOT)).toBe(false);
	});

	test('supports legacy fragment identifiers', () => {
		const validate = validator({
			$schema: 'http://json-schema.org/draft-07/schema#',
			definitions: {
				value: { $id: '#legacy', type: 'string' },
			},
			$ref: '#legacy',
		});

		expect(validate('yes', ROOT)).toBe(true);
		expect(validate(1, ROOT)).toBe(false);
	});

	test('applies ref siblings in 2019-09 and 2020-12', () => {
		const schema = {
			$defs: { number: { type: 'number' } },
			$ref: '#/$defs/number',
			maximum: 2,
		};

		expect(accepts(schema, 2, '2019-09')).toBe(true);
		expect(accepts(schema, 3, '2019-09')).toBe(false);
		expect(accepts(schema, 3, '2020-12')).toBe(false);
	});

	test('evaluates legacy property and schema dependencies', () => {
		const validate = validator({
			$schema: 'http://json-schema.org/draft-07/schema#',
			dependencies: {
				foo: ['bar'],
				baz: { required: ['quux'] },
			},
		});

		expect(validate({ foo: 1, bar: 2, baz: 3, quux: 4 }, ROOT)).toBe(true);
		expect(validate({ foo: 1 }, ROOT)).toBe(false);
		expect(validate({ baz: 3 }, ROOT)).toBe(false);
	});

	test('terminates direct schema and instance-location cycles', () => {
		expect(accepts({ $ref: '#', type: 'integer' }, 1)).toBe(true);
		expect(accepts({ $ref: '#', type: 'integer' }, 'no')).toBe(false);
		expect(
			accepts(
				{
					type: 'object',
					properties: { child: { $ref: '#' } },
					additionalProperties: false,
				},
				{ child: { child: {} } }
			)
		).toBe(true);
	});
});

describe('dynamic and recursive scope', () => {
	test('uses the outermost matching dynamic anchor and pops scope after each call', () => {
		const validate = validator({
			$id: ROOT,
			$dynamicAnchor: 'node',
			$ref: 'base.json',
			required: ['label'],
			properties: { label: { type: 'string' } },
			unevaluatedProperties: false,
			$defs: {
				base: {
					$id: 'base.json',
					$dynamicAnchor: 'node',
					type: 'object',
					properties: {
						children: { type: 'array', items: { $dynamicRef: '#node' } },
					},
					$defs: { defaultNode: { $dynamicAnchor: 'node' } },
				},
			},
		});

		expect(validate({ label: 'root', children: [{ label: 'child' }] }, ROOT)).toBe(true);
		expect(validate({ label: 'root', children: [{}] }, ROOT)).toBe(false);
		expect(
			validate(
				{ label: 'root', children: [{ label: 'child', children: [{ label: 'leaf' }] }] },
				ROOT
			)
		).toBe(true);
		expect(validate({ label: 'root' }, ROOT)).toBe(true);
	});

	test('keeps same-named anchors isolated between validator instances', () => {
		const stringTree = validator({
			$ref: 'base.json',
			$defs: {
				derived: { $dynamicAnchor: 'node', type: 'string' },
				base: {
					$id: 'base.json',
					type: 'array',
					items: { $dynamicRef: '#node' },
					$defs: { node: { $dynamicAnchor: 'node', type: 'string' } },
				},
			},
		});
		const numberTree = validator({
			$ref: 'base.json',
			$defs: {
				derived: { $dynamicAnchor: 'node', type: 'number' },
				base: {
					$id: 'base.json',
					type: 'array',
					items: { $dynamicRef: '#node' },
					$defs: { node: { $dynamicAnchor: 'node', type: 'string' } },
				},
			},
		});

		expect(stringTree(['a', 'b'], ROOT)).toBe(true);
		expect(numberTree([1, 2], ROOT)).toBe(true);
		expect(stringTree([1], ROOT)).toBe(false);
		expect(numberTree(['a'], ROOT)).toBe(false);
		expect(stringTree(['a'], ROOT)).toBe(true);
	});

	test('uses the outermost recursive anchor only when the static target has one', () => {
		const validate = validator(
			{
				$id: ROOT,
				$recursiveAnchor: true,
				$ref: '#/$defs/tree',
				required: ['extra'],
				$defs: {
					tree: {
						$id: 'tree.json',
						$recursiveAnchor: true,
						type: 'object',
						properties: { child: { $recursiveRef: '#' } },
					},
				},
			},
			'2019-09'
		);

		expect(validate({ extra: true, child: { extra: true } }, ROOT)).toBe(true);
		expect(validate({ extra: true, child: {} }, ROOT)).toBe(false);
	});

	test('does not leak a dynamic scope after a branch returns', () => {
		const validate = validator({
			if: {
				$id: 'first.json',
				$defs: { value: { $dynamicAnchor: 'value', type: 'number' } },
			},
			then: {
				$id: 'then.json',
				$ref: 'start.json',
				$defs: { value: { $dynamicAnchor: 'value', type: 'null' } },
			},
			$defs: {
				start: {
					$id: 'start.json',
					$dynamicRef: 'inner.json#value',
				},
				inner: {
					$id: 'inner.json',
					$dynamicAnchor: 'value',
					type: 'string',
				},
			},
		});

		expect(validate('text', ROOT)).toBe(false);
		expect(validate(1, ROOT)).toBe(false);
		expect(validate(null, ROOT)).toBe(true);
	});
});

describe('unevaluated annotations', () => {
	test('merges all successful anyOf branches but not failed branches', () => {
		const schema = {
			anyOf: [
				{ required: ['a'], properties: { a: { const: 1 } } },
				{ required: ['b'], properties: { b: { const: 2 } } },
			],
			unevaluatedProperties: false,
		};

		expect(accepts(schema, { a: 1, b: 2 })).toBe(true);
		expect(accepts(schema, { a: 0, b: 2 })).toBe(false);
		expect(accepts(schema, { a: 1, c: 3 })).toBe(false);
	});

	test('merges ref, conditional, and dependent schema annotations', () => {
		const schema = {
			$defs: { ref: { properties: { fromRef: true } } },
			$ref: '#/$defs/ref',
			properties: { trigger: true },
			if: { properties: { condition: { const: true } }, required: ['condition'] },
			then: { properties: { fromThen: true } },
			else: { properties: { fromElse: true } },
			dependentSchemas: { trigger: { properties: { fromDependency: true } } },
			unevaluatedProperties: false,
		};

		expect(
			accepts(schema, { fromRef: 1, condition: true, fromThen: 2, trigger: 3, fromDependency: 4 })
		).toBe(true);
		expect(accepts(schema, { fromRef: 1, fromElse: 2 })).toBe(true);
		expect(accepts(schema, { fromRef: 1, condition: false, fromThen: 2 })).toBe(false);
	});

	test('contains annotates matches, including a zero minimum', () => {
		const schema = {
			prefixItems: [true],
			contains: { type: 'string' },
			minContains: 0,
			unevaluatedItems: false,
		};

		expect(accepts(schema, [1, 'a'])).toBe(true);
		expect(accepts(schema, [1, 2])).toBe(false);
		expect(accepts(schema, ['a', 'b'])).toBe(true);
	});

	test('does not leak child-location annotations to the parent', () => {
		const schema = {
			properties: {
				child: { properties: { nested: true }, unevaluatedProperties: false },
			},
			unevaluatedProperties: false,
		};

		expect(accepts(schema, { child: { nested: true } })).toBe(true);
		expect(accepts(schema, { nested: true })).toBe(false);
	});

	test('discards not annotations while still evaluating them internally', () => {
		const schema = {
			not: {
				anyOf: [true, { properties: { forbidden: true } }],
				unevaluatedProperties: false,
			},
		};

		expect(accepts(schema, { other: 1 })).toBe(true);
		expect(accepts(schema, { forbidden: 1 })).toBe(false);
	});
});

describe('vocabularies and ordinary validation', () => {
	test('keeps applicators active when a custom metaschema disables validation', () => {
		const meta = 'https://schemas.test/no-validation.json';
		const validate = validator(
			{
				$schema: meta,
				type: 'object',
				properties: {
					forbidden: false,
					number: { minimum: 10 },
				},
			},
			'2020-12',
			{
				[meta]: {
					$id: meta,
					$vocabulary: {
						'https://json-schema.org/draft/2020-12/vocab/core': true,
						'https://json-schema.org/draft/2020-12/vocab/applicator': true,
						'https://json-schema.org/draft/2020-12/vocab/validation': false,
					},
				},
			}
		);

		expect(validate({ number: 1 }, ROOT)).toBe(true);
		expect(validate('not an object', ROOT)).toBe(true);
		expect(validate({ forbidden: 1 }, ROOT)).toBe(false);
	});

	test('uses integer, code-point length, deep equality, and decimal multipleOf', () => {
		expect(accepts({ type: 'integer' }, 1.5)).toBe(false);
		expect(accepts({ type: 'integer' }, 1)).toBe(true);
		expect(accepts({ maxLength: 1 }, '😀')).toBe(true);
		expect(accepts({ maxLength: 1 }, '😀x')).toBe(false);
		expect(accepts({ const: { a: [1, 2] } }, { a: [1, 2] })).toBe(true);
		expect(accepts({ const: { a: [1, 2] } }, { a: [2, 1] })).toBe(false);
		expect(accepts({ multipleOf: 0.0001 }, 0.0075)).toBe(true);
		expect(accepts({ multipleOf: 0.0001 }, 0.00751)).toBe(false);
	});

	test('handles tuple syntax, property names, and dependent required', () => {
		expect(
			accepts({ items: [{ type: 'string' }], additionalItems: false }, ['a', 1], '2019-09')
		).toBe(false);
		expect(accepts({ prefixItems: [{ type: 'string' }], items: false }, ['a', 1], '2020-12')).toBe(
			false
		);
		expect(accepts({ propertyNames: { maxLength: 1 } }, { long: true })).toBe(false);
		expect(accepts({ dependentRequired: { credit: ['billing'] } }, { credit: 1 })).toBe(false);
		expect(
			accepts({ dependentRequired: { credit: ['billing'] } }, { credit: 1, billing: 'x' })
		).toBe(true);
	});

	test('ignores format and never mutates or coerces input', () => {
		const schema = Object.freeze({
			type: 'object',
			properties: Object.freeze({
				count: Object.freeze({ type: 'integer', default: 5, format: 'email' }),
			}),
			required: Object.freeze(['count']),
		});
		const value = Object.freeze({ count: 1 });

		expect(accepts(schema, value)).toBe(true);
		expect(value).toEqual({ count: 1 });
		expect(accepts({ format: 'email' }, 'not an email', '2020-12')).toBe(true);
	});
});
