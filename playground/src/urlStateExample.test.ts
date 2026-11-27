import { expect, test } from 'vitest';

import { readUrlState } from './urlState';
import { example, state } from './test/urlStateFixtures';

test('loads an example even when it is the only recognized URL parameter', () => {
	const base = state();

	expect(readUrlState(new URL('https://example.com/?example=const'), base, example())).toEqual({
		files: example().files,
		target: 'zod',
		keywordPolicy: 'ignore',
		formatMode: 'annotate',
		inference: 'spec',
		data: '"green"',
	});
});

test('URL settings override an example while the saved policy and format remain fallbacks', () => {
	const base = state();
	const url = new URL('https://example.com/?generator=typescript&keyword-policy=warn');

	expect(readUrlState(url, base, example())).toEqual({
		files: example().files,
		target: 'typescript',
		keywordPolicy: 'warn',
		formatMode: 'annotate',
		inference: 'spec',
		data: '"green"',
	});
});
