import { describe, expect, it } from 'vitest';

import { withMeta } from './test-utils';

import { sortSchemasByDependency } from '../src/sorter';

describe('sortSchemasByDependency', () => {
	it('orders referenced schema before dependent', () => {
		const dep = withMeta({ type: 'string' });
		const main = withMeta({ $ref: '#/dep' }, { reference: dep });
		const result = sortSchemasByDependency([main, dep]);
		expect(result.indexOf(dep)).toBeLessThan(result.indexOf(main));
	});

	it('orders $defs schema before dependent', () => {
		const def = withMeta({ type: 'number' });
		const main = withMeta({ $defs: { Foo: def } });
		const result = sortSchemasByDependency([main, def]);
		expect(result.indexOf(def)).toBeLessThan(result.indexOf(main));
	});

	it('orders definitions schema before dependent', () => {
		const def = withMeta({ type: 'boolean' });
		const main = withMeta({ definitions: { Bar: def } });
		const result = sortSchemasByDependency([main, def]);
		expect(result.indexOf(def)).toBeLessThan(result.indexOf(main));
	});

	it('handles multiple dependencies', () => {
		const a = withMeta({ type: 'string' });
		const b = withMeta({ type: 'number' });
		const main = withMeta({ $defs: { A: a, B: b } });
		const result = sortSchemasByDependency([main, a, b]);
		expect(result.indexOf(a)).toBeLessThan(result.indexOf(main));
		expect(result.indexOf(b)).toBeLessThan(result.indexOf(main));
	});

	it('handles dependency chains', () => {
		const a = withMeta({ type: 'string' });
		const b = withMeta({ $ref: '#/a' }, { reference: a });
		const c = withMeta({ $ref: '#/b' }, { reference: b });
		const result = sortSchemasByDependency([c, b, a]);
		expect(result.indexOf(a)).toBeLessThan(result.indexOf(b));
		expect(result.indexOf(b)).toBeLessThan(result.indexOf(c));
	});

	it('removes duplicates in output', () => {
		const a = withMeta({ type: 'string' });
		const b = withMeta({ $ref: '#/a' }, { reference: a });
		const result = sortSchemasByDependency([a, b, a]);
		expect(result.filter((s) => s === a).length).toBe(1);
	});
});
