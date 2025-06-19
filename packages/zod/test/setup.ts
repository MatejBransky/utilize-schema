import { expect } from 'vitest';

expect.extend({
	async toMatchCode(actual: Promise<string>, expected: Promise<string>) {
		const actualCode = await actual;
		const expectedCode = await expected;
		const pass = this.equals(actualCode, expectedCode);

		return {
			pass,
			message: pass
				? () => `Expected code to match`
				: () => `Received: 
${this.utils.printReceived(actualCode)}

Diff:
${this.utils.printDiffOrStringify(actualCode, expectedCode)}`,
		};
	},
});
