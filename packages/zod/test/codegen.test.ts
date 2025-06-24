import { describe, expect, it } from 'vitest';

import { compile } from '../src';

describe('Codegen', () => {
	it('works', async () => {
		const input = './definitions/Example.json';
		const output = './snapshots/Example.generated.ts';

		expect(() => compile({ input, output, cwd: __dirname })).not.toThrow();
	});
});
