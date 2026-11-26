import { describe, expect, it } from 'vitest';

import { childSchemasOf, collectStandaloneSchemas, Meta } from '../src';
import type { JSONSchema, ParsedJSONSchemaObject } from '../src';

function withMeta<T extends JSONSchema>(
	schema: T,
	meta: Partial<Meta> = {}
): T & ParsedJSONSchemaObject {
	defineMeta(schema, meta);

	return schema;
}

function defineMeta<T extends object>(
	schema: T,
	meta: Partial<Meta>
): asserts schema is T & ParsedJSONSchemaObject {
	Object.defineProperty(schema, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});
}

describe('collectStandaloneSchemas', () => {
	it('includes root schema', () => {
		const root = withMeta({ type: 'string' });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toEqual([root]);
	});

	it('collects schemas from $defs', () => {
		const def = withMeta({ type: 'number' });
		const root = withMeta({ $defs: { Foo: def } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toEqual([def, root]);
	});

	it('collects schemas from definitions', () => {
		const def = withMeta({ type: 'boolean' });
		const root = withMeta({ definitions: { Bar: def } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toEqual([def, root]);
	});

	it('reads only $defs when a schema has both namespaces', () => {
		const fromDefs = withMeta({ type: 'number' });
		const fromDefinitions = withMeta({ type: 'string' });
		const root = withMeta({ $defs: { A: fromDefs }, definitions: { B: fromDefinitions } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toEqual([fromDefs, root]);
	});

	it('collects referenced schemas', () => {
		const reference = withMeta({ type: 'string' });
		const node = withMeta({ $ref: '#/foo' }, { reference });
		const root = withMeta({ properties: { foo: node } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toEqual([reference, root]);
	});

	it('deduplicates schemas', () => {
		const def = withMeta({ type: 'number' });
		const node = withMeta({ $ref: '#/defs/Num' }, { reference: def });
		const root = withMeta({ $defs: { Num: def }, properties: { foo: node } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas.filter((schema) => schema === def)).toHaveLength(1);
	});

	it('recursively collects nested $defs and references', () => {
		const deep = withMeta({ type: 'boolean' });
		const mid = withMeta({ $defs: { Deep: deep } });
		const ref = withMeta({ $ref: '#/mid' }, { reference: mid });
		const root = withMeta({ $defs: { Mid: mid }, properties: { foo: ref } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toContain(deep);
		expect(schemas).toContain(mid);
		expect(schemas).not.toContain(ref);
		expect(schemas).toContain(root);
	});

	it('reports edges for references, in visit order', () => {
		const external = withMeta({ $id: 'external', type: 'number' });
		const definitionA = withMeta({ $id: 'definitionA', type: 'string' });
		const definitionB = withMeta({ $ref: './external.json' }, { reference: external });
		const propertyA = withMeta({ $ref: '#/definitions/A' }, { reference: definitionA });
		const propertyB = withMeta({ $ref: '#/definitions/B' }, { reference: definitionB });
		const root = withMeta({
			$id: 'root',
			type: 'object',
			properties: { a: propertyA, b: propertyB },
			definitions: { A: definitionA, B: definitionB },
		});

		const { edges } = collectStandaloneSchemas(root);

		// Definitions have no parent: only $ref edges order them.
		expect(edges).toEqual([
			[null, root],
			[null, definitionA],
			[null, definitionB],
			[definitionB, external],
			[root, propertyA],
			[propertyA, definitionA],
			[root, propertyB],
			[propertyB, definitionB],
		]);
	});

	it('treats an inline copy as a reference to its declaration', () => {
		const declaration = withMeta({ type: 'object', properties: { id: { type: 'string' } } });
		const copyChild = withMeta({ type: 'string' });
		const copy = withMeta({ type: 'object', properties: { id: copyChild } });
		const root = withMeta({ properties: { item: copy } });

		const { schemas, edges } = collectStandaloneSchemas(root, {
			inlineCopies: new Map([[copy, declaration]]),
		});

		expect(schemas).toEqual([declaration, root]);
		const edgesFromCopy = edges.filter(([from]) => from === copy);

		expect(edgesFromCopy).toHaveLength(1);
		expect(edgesFromCopy[0]?.[1]).toBe(declaration);
		expect(edges.some(([, to]) => to === copyChild)).toBe(false);
	});

	it('reads definitions through definitionsOf', () => {
		const fromDefs = withMeta({ type: 'number' });
		const fromDefinitions = withMeta({ type: 'string' });
		const root = withMeta({ $defs: { A: fromDefs }, definitions: { B: fromDefinitions } });

		const { schemas } = collectStandaloneSchemas(root, {
			definitionsOf: (schema) =>
				[schema.$defs, schema.definitions].flatMap((definitions) =>
					Object.values(definitions ?? {})
				),
		});

		expect(schemas).toEqual([fromDefs, fromDefinitions, root]);
	});

	it('visits each definition before reading the next one', () => {
		const nested = withMeta({ type: 'boolean' });
		const first = withMeta({ $defs: { Nested: nested } });
		const second = withMeta({ type: 'string' });
		const root = withMeta({ $defs: { First: first, Second: second } });
		const read: ParsedJSONSchemaObject[] = [];

		collectStandaloneSchemas(root, {
			*definitionsOf(schema) {
				for (const definition of Object.values(schema.$defs ?? {})) {
					read.push(definition);
					yield definition;
				}
			},
		});

		expect(read).toEqual([first, nested, second]);
	});
});

describe('childSchemasOf', () => {
	it('lists subschemas in keyword order and skips booleans, $defs and $ref targets', () => {
		const property = withMeta({ type: 'string' });
		const item = withMeta({ type: 'number' });
		const branch = withMeta({ type: 'null' });
		const dependency = withMeta({ required: ['a'] });
		const definition = withMeta({ type: 'boolean' });
		const schema = withMeta({
			properties: { a: property },
			additionalProperties: false,
			items: [item, true],
			anyOf: [branch],
			dependencies: { a: dependency, b: ['a'] },
			$defs: { Definition: definition },
		});

		expect(childSchemasOf(schema)).toEqual([property, item, branch, dependency]);
	});
});
