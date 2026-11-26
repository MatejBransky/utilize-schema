import { Meta } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';
import { describe, expect, it } from 'vitest';

import { resolveName } from '../src/resolveName';

import { withMeta } from './test-utils';

// The shared naming rules are tested in @utilize/json-schema. These tests cover
// what the TypeScript generator adds on top.
function stripSchemaSuffix(candidate: ParsedJSONSchemaObject) {
	candidate[Meta].fileName = candidate[Meta].fileName.replace(/\.schema$/, '');
}

function rootResolver(candidate: ParsedJSONSchemaObject) {
	return candidate[Meta].parent === null ? 'Root' : undefined;
}

describe('resolveName', () => {
	it('names a schema like the shared resolveName', () => {
		const used = new Set(['MyDef']);
		const schema = withMeta({}, { path: ['root', '$defs', 'MyDef'] });

		expect(resolveName({ schema, usedNames: used })).toBe('MyDef1');
	});

	it('uses custom resolver if provided', () => {
		const schema = withMeta({}, { parent: null, fileName: 'kebab-case.schema' });

		expect(resolveName({ schema, customResolver: stripSchemaSuffix })).toBe('KebabCase');
	});

	it('reserves a custom name so automatic names do not reuse it', () => {
		const used = new Set<string>();
		const root = withMeta({}, { parent: null });
		const definition = withMeta({}, { parent: root, path: ['$defs', 'Root'] });
		// The conformance runner names only the root.

		expect(resolveName({ schema: root, usedNames: used, customResolver: rootResolver })).toBe(
			'Root'
		);
		expect(resolveName({ schema: definition, usedNames: used })).toBe('Root1');
	});
});
