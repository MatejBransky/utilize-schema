import { UnsupportedPatternError } from './errors';

/**
 * Compiles a JSON Schema regex in Unicode mode, which is what the specification
 * requires, and names the keyword when the pattern is invalid there. The
 * generated code holds the same expression, so a pattern that fails here would
 * otherwise fail with a bare `SyntaxError` on the first compile.
 */
export function unicodePattern(pattern: string, keyword: string): RegExp {
	try {
		return new RegExp(pattern, 'u');
	} catch {
		throw new UnsupportedPatternError(keyword, pattern);
	}
}
