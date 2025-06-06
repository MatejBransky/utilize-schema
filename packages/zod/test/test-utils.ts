import prettierConfig from '@utilize/prettier-config/prettier.json';
import {
	format as prettierFormat,
	type Options as PrettierOptions,
} from 'prettier';

export function format(code: string) {
	return prettierFormat(code, {
		...(prettierConfig as PrettierOptions),
		parser: 'typescript',
	});
}

/**
 * A tagged template literal function that formats TypeScript code.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const rawString = String.raw(strings, ...values);
	return format(rawString);
};
