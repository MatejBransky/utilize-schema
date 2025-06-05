import { expect, test } from 'vitest';

import { hello } from '../src/index';

test('example test', () => {
	expect(hello('World')).toBe('Hello, World!');
});
