import { expect, test } from 'vitest';

import { generate } from '../src';

test('generate', () => {
	expect(generate()).toBeNull();
});
