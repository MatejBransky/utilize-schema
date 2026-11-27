import { expect, test } from 'vitest';

import {
	readFormatModeParam,
	readGeneratorParam,
	readInferenceParam,
	readKeywordPolicyParam,
	readUrlState,
} from './urlState';
import { state } from './test/urlStateFixtures';

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
	expect(
		readUrlState(new URL('https://example.com/?generator=typescript&inference=pragmatic'), base)
	).toEqual({
		...base,
		target: 'typescript',
		inference: 'pragmatic',
	});
	expect(
		readUrlState(new URL('https://example.com/?generator=effect&inference=pragmatic'), base)
	).toEqual({
		...base,
		target: 'effect',
	});
});

test('parameter readers ignore missing and invalid values', () => {
	const url = new URL(
		'https://example.com/?generator=effect&keyword-policy=warn&format-mode=assert'
	);

	expect(readGeneratorParam(url)).toBe('effect');
	expect(readKeywordPolicyParam(url)).toBe('warn');
	expect(readFormatModeParam(url)).toBe('assert');
	expect(readInferenceParam(url)).toBeNull();

	const empty = new URL('https://example.com/');
	expect(readGeneratorParam(empty)).toBeNull();
	expect(readKeywordPolicyParam(empty)).toBeNull();
	expect(readFormatModeParam(empty)).toBeNull();
	expect(readInferenceParam(empty)).toBeNull();
	expect(readInferenceParam(new URL('https://example.com/?inference=pragmatic'))).toBe('pragmatic');
	expect(readInferenceParam(new URL('https://example.com/?inference=spec'))).toBe('spec');
});
