import { describe, expect, it } from 'vitest';

import { collectStandaloneSchemas } from '../src/collectStandaloneSchemas';

import { withMeta } from './test-utils';

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
		const reference = withMeta({ type: 'string' });
		const node = withMeta({ $ref: '#/foo' }, { reference });
		const root = withMeta({ properties: { foo: node } });
		const { schemas } = collectStandaloneSchemas(root);

		expect(schemas).toContain(reference);
		expect(schemas).toContain(root);
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

	it('reports edges for references', () => {
		const def = withMeta({ type: 'number' });
		const node = withMeta({ $ref: '#/defs/Num' }, { reference: def });
		const root = withMeta({ $defs: { Num: def }, properties: { foo: node } });
		const { edges } = collectStandaloneSchemas(root);

		expect(edges).toContainEqual([root, node]);
		expect(edges).toContainEqual([node, def]);
	});
});
