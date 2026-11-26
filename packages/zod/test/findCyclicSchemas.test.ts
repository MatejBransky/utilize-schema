import type { JSONSchema, ParsedJSONSchemaObject, SchemaEdge } from '@utilize/json-schema';
import { describe, expect, test } from 'vitest';

import { findCyclicSchemas } from '../src/findCyclicSchemas';

function schemaNode(schema: JSONSchema): ParsedJSONSchemaObject {
	return schema as ParsedJSONSchemaObject;
}

describe('findCyclicSchemas', () => {
	test('keeps a self-referencing structural schema in the cyclic set', () => {
		const node = schemaNode({ type: 'object' });
		const edges: SchemaEdge[] = [[node, node]];

		const result = findCyclicSchemas(edges, [node]);

		expect(result.schemas).toEqual(new Set([node]));
		expect(result.unsupported).toEqual([]);
	});

	test('keeps every standalone member of a structural cycle', () => {
		const first = schemaNode({ type: 'object' });
		const second = schemaNode({ anyOf: [{ type: 'string' }, { type: 'number' }] });
		const edges: SchemaEdge[] = [
			[first, second],
			[second, first],
		];

		const result = findCyclicSchemas(edges, [first, second]);

		expect(result.schemas).toEqual(new Set([first, second]));
		expect(result.unsupported).toEqual([]);
	});

	test('reports a cycle without a structural anchor as unsupported', () => {
		const first = schemaNode({ anyOf: [{ type: 'string' }, { type: 'number' }] });
		const second = schemaNode({ anyOf: [{ type: 'boolean' }, { type: 'null' }] });
		const edges: SchemaEdge[] = [
			[first, second],
			[second, first],
		];

		const result = findCyclicSchemas(edges, [first, second]);

		expect(result.schemas).toEqual(new Set());
		expect(result.unsupported).toEqual([[first, second]]);
	});
});
