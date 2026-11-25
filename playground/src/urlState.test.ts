import { expect, test } from 'vitest';

import type { SchemaFile } from './bundle';
import type { Example } from './examples';
import {
	readFormatModeParam,
	readGeneratorParam,
	readKeywordPolicyParam,
	readUrlState,
	type UrlState,
} from './urlState';

function file(id: string): SchemaFile {
	return { id, name: `${id}.json`, content: '{}' };
}

function state(): UrlState {
	return {
		files: [file('saved')],
		target: 'effect',
		keywordPolicy: 'ignore',
		formatMode: 'annotate',
		data: '{"saved":true}',
	};
}

function example(): Example {
	return {
		id: 'const',
		name: 'Const',
		group: 'Basics',
		files: [file('const')],
		cases: [{ label: 'Valid', expect: 'valid', data: 'green' }],
	};
}

test('returns null when the URL has no recognized playground parameters', () => {
	const base = state();

	expect(readUrlState(new URL('https://example.com/'), base)).toBeNull();
	expect(readUrlState(new URL('https://example.com/?unknown=value'), base)).toBeNull();
	expect(
		readUrlState(
			new URL('https://example.com/?generator=valibot&keyword-policy=no&format-mode=no'),
			base
		)
	).toBeNull();
});

test('applies each recognized URL parameter over the saved state', () => {
	const base = state();

	expect(readUrlState(new URL('https://example.com/?generator=zod'), base)).toEqual({
		...base,
		target: 'zod',
	});
	expect(readUrlState(new URL('https://example.com/?keyword-policy=error'), base)).toEqual({
		...base,
		keywordPolicy: 'error',
	});
	expect(readUrlState(new URL('https://example.com/?format-mode=assert'), base)).toEqual({
		...base,
		formatMode: 'assert',
	});
});

test('loads an example even when it is the only recognized URL parameter', () => {
	const base = state();

	expect(readUrlState(new URL('https://example.com/?example=const'), base, example())).toEqual({
		files: example().files,
		target: 'zod',
		keywordPolicy: 'ignore',
		formatMode: 'annotate',
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
		data: '"green"',
	});
});

test('parameter readers ignore missing and invalid values', () => {
	const url = new URL(
		'https://example.com/?generator=effect&keyword-policy=warn&format-mode=assert'
	);

	expect(readGeneratorParam(url)).toBe('effect');
	expect(readKeywordPolicyParam(url)).toBe('warn');
	expect(readFormatModeParam(url)).toBe('assert');

	const empty = new URL('https://example.com/');
	expect(readGeneratorParam(empty)).toBeNull();
	expect(readKeywordPolicyParam(empty)).toBeNull();
	expect(readFormatModeParam(empty)).toBeNull();
});
