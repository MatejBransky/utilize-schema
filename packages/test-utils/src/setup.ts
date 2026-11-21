/**
 * Registers the `toMatchCode` matcher. A package's Vitest setup file imports
 * this module, which also brings the matcher's type into its tests.
 */
import { expect } from 'vitest';

import { normalizeCode } from './code';

declare module 'vitest' {
	// Same type parameters as Vitest's own declaration, which this merges into.
	interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
		toMatchCode: (expectedCode: Promise<string>) => R;
	}
}

expect.extend({
	async toMatchCode(actual: Promise<string>, expected: Promise<string>) {
		const actualCode = normalizeCode(await actual);
		const expectedCode = normalizeCode(await expected);
		const pass = this.equals(actualCode, expectedCode);

		return {
			pass,
			message: pass
				? () => `Expected code to match`
				: () => `${this.testPath}
Test: ${this.currentTestName}
Received:
${this.utils.printReceived(actualCode)}

Diff:
${this.utils.printDiffOrStringify(actualCode, expectedCode)}`,
		};
	},
});
