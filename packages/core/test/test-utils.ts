import { test } from 'vitest';

export interface TestCaseBase {
	title: string;
	state?: 'skip' | 'todo' | 'only';
}

export const runTestCases = <C extends TestCaseBase>(
	testCases: C[],
	testFn: (testCase: C) => void
) => {
	testCases.forEach((testCase) => {
		const testMethod = testCase.state ? test[testCase.state] : test;

		testMethod(testCase.title, () => {
			testFn(testCase);
		});
	});
};
