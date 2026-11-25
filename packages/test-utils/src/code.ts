import { format } from 'oxfmt';

/** The formatting the tests compare generated code with. */
const formatOptions = {
	bracketSpacing: true,
	endOfLine: 'lf',
	semi: true,
	singleQuote: true,
	trailingComma: 'es5',
	useTabs: true,
	objectWrap: 'collapse',
} as const;

/** Formats TypeScript code the way the tests compare it. */
export function formatSource(code: string): Promise<string> {
	return format('code.ts', code, formatOptions).then((result) => result.code);
}

/**
 * A tagged template literal function for expected TypeScript code. Code is
 * compared with whitespace normalized, so the generated output does not need
 * to be formatted.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]): Promise<string> =>
	formatSource(String.raw(strings, ...values));

export function normalizeCode(code: string): string {
	return code.replaceAll(/\r\n?/g, '\n').trim();
}
