import { type ParsedJSONSchema } from '@utilize/json-schema';
import { describe, expect, it } from 'vitest';

import { withMeta } from './test-utils';

import { collectStandaloneSchemas } from '../src/collectStandaloneSchemas';

describe('collectStandaloneSchemas', () => {
	it('includes root schema', () => {
		const root = withMeta({ type: 'string' });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		expect(result).toContain(root);
	});

	it('collects schemas from $defs', () => {
		const def = withMeta({ type: 'number' });
		const root = withMeta({ $defs: { Foo: def } });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		expect(result).toContain(def);
		expect(result).toContain(root);
	});

	it('collects schemas from definitions', () => {
		const def = withMeta({ type: 'boolean' });
		const root = withMeta({ definitions: { Bar: def } });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		expect(result).toContain(def);
		expect(result).toContain(root);
	});

	it('collects referenced schemas', () => {
		const ref = withMeta({ type: 'string' });
		const node = withMeta({ $ref: '#/foo' }, { reference: ref });
		const root = withMeta({ properties: { foo: node } });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		expect(result).toContain(ref);
		expect(result).toContain(root);
	});

	it('deduplicates schemas', () => {
		const def = withMeta({ type: 'number' });
		const node = withMeta({ $ref: '#/defs/Num' }, { reference: def });
		const root = withMeta({ $defs: { Num: def }, properties: { foo: node } });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		// Should only contain one instance of def
		expect(result.filter((s) => s === def).length).toBe(1);
	});

	it('recursively collects nested $defs and references', () => {
		const deep = withMeta({ type: 'boolean' });
		const mid = withMeta({ $defs: { Deep: deep } });
		const ref = withMeta({ $ref: '#/mid' }, { reference: mid });
		const root = withMeta({ $defs: { Mid: mid }, properties: { foo: ref } });
		const result = collectStandaloneSchemas(root as ParsedJSONSchema);
		expect(result).toContain(deep);
		expect(result).toContain(mid);
		expect(result).not.toContain(ref);
		expect(result).toContain(root);
	});
});
