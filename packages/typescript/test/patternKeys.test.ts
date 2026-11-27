import { describe, expect, test } from 'vitest';

import { patternKeys } from '../src/patternKeys';

describe('patternKeys', () => {
	test('turns an anchored literal into a string literal', () => {
		expect(patternKeys('^x-')).toEqual({
			keyType: '`x-${string}`',
			keys: undefined,
		});
		expect(patternKeys('^x-$')).toEqual({ keyType: "'x-'", keys: ['x-'] });
		expect(patternKeys(String.raw`^\$schema$`)).toEqual({
			keyType: "'$schema'",
			keys: ['$schema'],
		});
	});

	test('renders alternation as a template literal', () => {
		expect(patternKeys('^applies_to_(foo|bar)$')).toEqual({
			keyType: "`applies_to_${'foo' | 'bar'}`",
			keys: ['applies_to_foo', 'applies_to_bar'],
		});
	});

	test('keeps unanchored patterns open on both sides', () => {
		expect(patternKeys('applies_to_(foo|bar)')).toEqual({
			keyType: "`${string}applies_to_${'foo' | 'bar'}${string}`",
			keys: undefined,
		});
		expect(patternKeys('x-')).toEqual({
			keyType: '`${string}x-${string}`',
			keys: undefined,
		});
		expect(patternKeys('a|b')).toEqual({
			keyType: "`${string}${'a' | 'b'}${string}`",
			keys: undefined,
		});
	});

	test('expands character classes and ranges', () => {
		expect(patternKeys('^[ab]-[0-2]$')).toEqual({
			keyType: "`${'a' | 'b'}-${'0' | '1' | '2'}`",
			keys: ['a-0', 'a-1', 'a-2', 'b-0', 'b-1', 'b-2'],
		});
	});

	test('supports escaped and unicode characters', () => {
		expect(patternKeys(String.raw`^\u0041\x42$`)).toEqual({ keyType: "'AB'", keys: ['AB'] });
		expect(patternKeys(String.raw`^\u{1F600}$`)).toEqual({
			keyType: "'😀'",
			keys: ['😀'],
		});
	});

	test('falls back for expressions a key type cannot describe', () => {
		for (const pattern of [
			'f.*o',
			'^a+$',
			'^a{2}$',
			String.raw`^\d+$`,
			'^[^a]$',
			'^(?!x)y$',
			String.raw`(a)(b)\1`,
			'^[a-z]{2,}$',
			'^$|foo',
			'^a|b$',
			'[',
		]) {
			expect(patternKeys(pattern), pattern).toBeUndefined();
		}
	});
});
