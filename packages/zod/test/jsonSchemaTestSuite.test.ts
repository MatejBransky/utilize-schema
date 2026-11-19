import { afterAll, describe, expect, test } from 'vitest';

import { DRAFT_7, isCompatible } from './suite/compatibility';
import { compileToZodSchema } from './suite/compile';
import { knownFailureInstances } from './suite/knownFailureInstances';
import { knownFailures } from './suite/knownFailures';
import { loadSuiteFiles, type SuiteCase, suiteCaseKey } from './suite/loadSuite';

/**
 * Runs the official JSON Schema Test Suite against the generated Zod schemas.
 *
 * Scope: draft-07, the dialect this package generates for. The suite keeps all
 * dialects in one file and marks each case with `compatibility`, so cases for
 * older and newer releases are filtered out here.
 *
 * Cases tagged `format-annotation` are not run: the generator asserts known
 * formats, while those cases expect `format` to be ignored.
 *
 * Known gaps live in `suite/knownFailures.ts` and run as expected failures, so
 * CI stays green until the gap is fixed.
 */

const files = loadSuiteFiles();

const stats = {
	cases: 0,
	run: 0,
	knownGaps: 0,
	assertions: 0,
	failedAssertions: 0,
	skippedDialect: 0,
	skippedFormatAnnotation: 0,
};

type SkipKind = 'dialect' | 'format';

function skipReason(testCase: SuiteCase): { kind: SkipKind; reason: string } | undefined {
	if (!isCompatible(testCase.compatibility, DRAFT_7)) {
		return { kind: 'dialect', reason: 'not part of draft-07' };
	}

	if (testCase.tags?.includes('format-annotation')) {
		return {
			kind: 'format',
			reason: 'the default formatMode asserts formats, so annotation cases do not apply',
		};
	}

	return undefined;
}

afterAll(() => {
	console.log(
		[
			'JSON Schema Test Suite (draft-07)',
			`${stats.run - stats.knownGaps}/${stats.run} cases, ${
				stats.assertions - stats.failedAssertions
			}/${stats.assertions} assertions`,
			`${stats.skippedFormatAnnotation} skipped (format annotation)`,
			`${stats.skippedDialect} filtered out (other dialects)`,
		].join(' · ')
	);
});

for (const file of files) {
	const runnable: Array<{ testCase: SuiteCase; skip: ReturnType<typeof skipReason> }> = [];

	for (const testCase of file.cases) {
		stats.cases++;

		const skip = skipReason(testCase);

		if (skip?.kind === 'dialect') {
			stats.skippedDialect++;
			continue;
		}

		runnable.push({ testCase, skip });
	}

	// A file can be entirely outside the tested dialect; Vitest rejects empty suites.
	if (runnable.length === 0) {
		continue;
	}

	describe(file.name, () => {
		for (const { testCase, skip } of runnable) {
			if (skip) {
				stats.skippedFormatAnnotation++;

				test.skip(`${testCase.description} — skipped: ${skip.reason}`, () => {});
				continue;
			}

			stats.run++;
			stats.assertions += testCase.tests.length;

			const key = suiteCaseKey(file, testCase);
			const gap = knownFailures[key];

			if (gap) {
				stats.knownGaps++;
				const expected = knownFailureInstances[key];

				test(`${testCase.description} — known gap: ${gap}`, async () => {
					if (expected === 'compile') {
						stats.failedAssertions += testCase.tests.length;
						await expect(
							compileToZodSchema(testCase.schema, testCase.externalSchemas)
						).rejects.toThrow();
						return;
					}

					expect(
						expected,
						`No recorded failing instances for "${key}"; run the baseline update script`
					).toBeDefined();
					expect(
						(expected as string[]).length,
						`"${key}" no longer fails; remove the entry`
					).toBeGreaterThan(0);

					const zodSchema = await compileToZodSchema(testCase.schema, testCase.externalSchemas);
					const failures = testCase.tests
						.filter((suiteTest) => zodSchema.safeParse(suiteTest.data).success !== suiteTest.valid)
						.map((suiteTest) => suiteTest.description);

					stats.failedAssertions += failures.length;

					expect([...failures].sort()).toEqual([...(expected as string[])].sort());
				});
				continue;
			}

			test(testCase.description, async () => {
				let failures: string[];

				try {
					const zodSchema = await compileToZodSchema(testCase.schema, testCase.externalSchemas);

					failures = testCase.tests
						.filter((suiteTest) => zodSchema.safeParse(suiteTest.data).success !== suiteTest.valid)
						.map(
							(suiteTest) =>
								`${suiteTest.description}: ${JSON.stringify(suiteTest.data)} should be ${
									suiteTest.valid ? 'valid' : 'invalid'
								}`
						);
				} catch (error) {
					stats.failedAssertions += testCase.tests.length;
					throw error;
				}

				stats.failedAssertions += failures.length;

				expect(failures).toEqual([]);
			});
		}
	});
}

describe('known failures', () => {
	const exercised = new Map<string, string | undefined>();

	for (const file of files) {
		for (const testCase of file.cases) {
			exercised.set(suiteCaseKey(file, testCase), skipReason(testCase)?.reason);
		}
	}

	test('point at existing cases that are exercised', () => {
		const problems: string[] = [];

		for (const key of Object.keys(knownFailures)) {
			if (!exercised.has(key)) {
				problems.push(`${key}: no such case in the suite`);
				continue;
			}

			const reason = exercised.get(key);

			if (reason) {
				problems.push(`${key}: skipped because ${reason}`);
			}

			if (!(key in knownFailureInstances)) {
				problems.push(`${key}: no recorded failing instances`);
			}
		}

		for (const key of Object.keys(knownFailureInstances)) {
			if (!(key in knownFailures)) {
				problems.push(`${key}: recorded instances without a known-failure entry`);
			}
		}

		expect(problems).toEqual([]);
	});
});
