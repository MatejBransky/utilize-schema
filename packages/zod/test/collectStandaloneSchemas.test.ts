import toposort from 'toposort';
import { describe, expect, it } from 'vitest';

import { withMeta } from './test-utils';

import { collectStandaloneSchemas } from '../src/collectStandaloneSchemas';

describe('collectStandaloneSchemas', () => {
	it('includes root schema', () => {
		const root = withMeta({ type: 'string' });
		const { schemas } = collectStandaloneSchemas(root);
		expect(schemas).toContain(root);
	});

	it('collects schemas from $defs', () => {
		const def = withMeta({ type: 'number' });
		const root = withMeta({ $defs: { Foo: def } });
		const { schemas } = collectStandaloneSchemas(root);
		expect(schemas).toContain(def);
		expect(schemas).toContain(root);
	});

	it('collects schemas from definitions', () => {
		const def = withMeta({ type: 'boolean' });
		const root = withMeta({ definitions: { Bar: def } });
		const { schemas } = collectStandaloneSchemas(root);
		expect(schemas).toContain(def);
		expect(schemas).toContain(root);
	});

	it('collects referenced schemas', () => {
		const ref = withMeta({ type: 'string' });
		const node = withMeta({ $ref: '#/foo' }, { reference: ref });
		const root = withMeta({ properties: { foo: node } });
		const { schemas } = collectStandaloneSchemas(root);
		expect(schemas).toContain(ref);
		expect(schemas).toContain(root);
	});

	it('deduplicates schemas', () => {
		const def = withMeta({ type: 'number' });
		const node = withMeta({ $ref: '#/defs/Num' }, { reference: def });
		const root = withMeta({ $defs: { Num: def }, properties: { foo: node } });
		const { schemas } = collectStandaloneSchemas(root);
		// Should only contain one instance of def
		expect(schemas.filter((s) => s === def).length).toBe(1);
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

	it('sorts schemas by dependency', () => {
		const external = withMeta({ $id: 'external', type: 'number' });
		const definitionA = withMeta({ $id: 'definitionA', type: 'string' });
		const definitionB = withMeta(
			{ $ref: './external.json' },
			{ reference: external }
		);
		const propertyA = withMeta(
			{ $ref: '#/definitions/A' },
			{ reference: definitionA }
		);
		const propertyB = withMeta(
			{ $ref: '#/definitions/B' },
			{ reference: definitionB }
		);
		const root = withMeta(
			{
				$id: 'root',
				type: 'object',
				properties: {
					a: propertyA,
					b: propertyB,
				},
				definitions: {
					A: definitionA,
					B: definitionB,
				},
			},
			{}
		);

		const { edges } = collectStandaloneSchemas(root);
		expect(toposort(edges).reverse()).toMatchInlineSnapshot(`
			[
			  {
			    "$id": "external",
			    "type": "number",
			  },
			  {
			    "$ref": "./external.json",
			  },
			  {
			    "$ref": "#/definitions/B",
			  },
			  {
			    "$id": "definitionA",
			    "type": "string",
			  },
			  {
			    "$ref": "#/definitions/A",
			  },
			  {
			    "$id": "root",
			    "definitions": {
			      "A": {
			        "$id": "definitionA",
			        "type": "string",
			      },
			      "B": {
			        "$ref": "./external.json",
			      },
			    },
			    "properties": {
			      "a": {
			        "$ref": "#/definitions/A",
			      },
			      "b": {
			        "$ref": "#/definitions/B",
			      },
			    },
			    "type": "object",
			  },
			  null,
			]
		`);
	});
});
