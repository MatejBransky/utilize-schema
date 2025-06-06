import { expect, test } from 'vitest';

import { ASTNode } from '@utilize/json-schema-core';

import { generate } from '../src';

test('generate', () => {
	const node: ASTNode = {};
	expect(generate(node)).toBeNull();
});
