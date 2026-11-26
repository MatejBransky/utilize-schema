import { isCompatible } from './compatibility';
import type { Dialect } from './compatibility';
import { suiteCaseKey } from './loadSuite';
import type { SuiteCase, SuiteFile } from './loadSuite';

export interface DialectCounts {
	cases: number;
	passing: number;
	instances: number;
	passingInstances: number;
}

export interface DialectMeasurement {
	counts: DialectCounts;
	failing: string[];
}

/** Measures case and instance conformance for one dialect. */
export async function measureDialect<T>(
	files: SuiteFile[],
	token: Dialect,
	compile: (testCase: SuiteCase) => T | Promise<T>,
	accepts: (schema: T, data: unknown) => boolean
): Promise<DialectMeasurement> {
	const counts = { cases: 0, passing: 0, instances: 0, passingInstances: 0 };
	const failing: string[] = [];

	for (const file of files) {
		for (const testCase of file.cases) {
			if (!isCompatible(testCase.compatibility, token)) {
				continue;
			}

			counts.cases++;
			counts.instances += testCase.tests.length;

			let failed: number;

			try {
				const schema = await compile(testCase);
				failed = testCase.tests.filter(
					(suiteTest) => accepts(schema, suiteTest.data) !== suiteTest.valid
				).length;
			} catch {
				failed = testCase.tests.length;
			}

			counts.passingInstances += testCase.tests.length - failed;

			if (failed === 0) {
				counts.passing++;
			} else {
				failing.push(`${suiteCaseKey(file, testCase)} (${failed} failed)`);
			}
		}
	}

	return { counts, failing };
}
