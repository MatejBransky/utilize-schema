import { expect } from 'vitest';

import { normalizeCode } from './test-utils';

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
