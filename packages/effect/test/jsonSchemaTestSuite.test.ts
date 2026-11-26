import { describe, expect, test } from 'vitest';

import { DRAFT_7, isCompatible } from '@utilize/test-utils/suite/compatibility';

import { baseline } from './suite/baseline';
import { compileToEffectSchema } from './suite/compile';
import { knownFailureInstances } from './suite/knownFailureInstances';
import { knownFailures } from './suite/knownFailures';
import { decode } from './test-utils';
import { loadSuiteFiles, suiteCaseKey } from '@utilize/test-utils/suite/loadSuite';
import type { SuiteCase } from '@utilize/test-utils/suite/loadSuite';
import { measureDialect } from '@utilize/test-utils/suite/measureDialect';

/**
 * Runs the official JSON Schema Test Suite against the generated Zod schemas.
 *
 * Scope: every released dialect. The per-case expected failures below are
 * pinned for draft-07; cases outside draft-07 are measured against the
 * recorded dialect counts in `suite/baseline.ts`.
 *
 * Format cases are compiled in the mode they describe: `format-annotation`
 * cases with `formatMode: 'annotate'` and `format-assertion` cases with
 * `formatMode: 'assert'`. Both groups run, so neither half of the format
 * coverage is skipped.
 *
 * Known gaps live in `suite/knownFailures.ts` and run as expected failures, so
 * CI stays green until the gap is fixed.
 */

const files = loadSuiteFiles();
const totalCases = files.reduce((total, file) => total + file.cases.length, 0);

type SkipKind = 'dialect';

function skipReason(testCase: SuiteCase): { kind: SkipKind; reason: string } | undefined {
	if (!isCompatible(testCase.compatibility, DRAFT_7)) {
		return { kind: 'dialect', reason: 'not part of draft-07' };
	}

	return undefined;
}

/**
 * The suite tags each format case with the behaviour it expects, so compile it
 * in that mode instead of the generator default.
 */
function formatModeFor(testCase: SuiteCase): 'annotate' | 'assert' | undefined {
	if (testCase.tags?.includes('format-assertion')) {
		return 'assert';
	}

	if (testCase.tags?.includes('format-annotation')) {
		return 'annotate';
	}

	return undefined;
}

for (const file of files) {
	const runnable: { testCase: SuiteCase; skip: ReturnType<typeof skipReason> }[] = [];

	for (const testCase of file.cases) {
		const skip = skipReason(testCase);

		if (skip?.kind === 'dialect') {
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
				test.skip(`${testCase.description} — skipped: ${skip.reason}`, () => {});
				continue;
			}

			const key = suiteCaseKey(file, testCase);
			const gap = knownFailures[key];

			if (gap) {
				const expected = knownFailureInstances[key];

				test(`${testCase.description} — known gap: ${gap}`, async () => {
					if (expected === 'compile') {
						await expect(
							compileToEffectSchema(
								testCase.schema,
								testCase.externalSchemas,
								formatModeFor(testCase)
							)
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

					const schema = await compileToEffectSchema(
						testCase.schema,
						testCase.externalSchemas,
						formatModeFor(testCase)
					);
					const failures = testCase.tests
						.filter(
							(suiteTest) => (decode(schema, suiteTest.data) !== undefined) !== suiteTest.valid
						)
						.map((suiteTest) => suiteTest.description);

					expect([...failures].sort()).toEqual([...(expected as string[])].sort());
				});
				continue;
			}

			test(testCase.description, async () => {
				const schema = await compileToEffectSchema(
					testCase.schema,
					testCase.externalSchemas,
					formatModeFor(testCase)
				);

				const failures = testCase.tests
					.filter((suiteTest) => (decode(schema, suiteTest.data) !== undefined) !== suiteTest.valid)
					.map(
						(suiteTest) =>
							`${suiteTest.description}: ${JSON.stringify(suiteTest.data)} should be ${
								suiteTest.valid ? 'valid' : 'invalid'
							}`
					);

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

describe('baseline', () => {
	test('matches the recorded conformance baseline', async () => {
		const { counts, failing } = await measureDialect(
			files,
			DRAFT_7,
			(testCase) =>
				compileToEffectSchema(
					testCase.schema,
					testCase.externalSchemas,
					formatModeFor(testCase),
					'draft-07'
				),
			(schema, data) => decode(schema, data) !== undefined
		);

		console.log(
			[
				'Effect Schema Test Suite (draft-07)',
				`${counts.passing}/${counts.cases} cases, ${counts.passingInstances}/${counts.instances} assertions`,
				`${totalCases - counts.cases} outside this dialect (measured in the baseline)`,
			].join(' · ')
		);
		expect(counts, `Failing draft-07 cases (${failing.length}):\n${failing.join('\n')}`).toEqual(
			baseline['draft-07']
		);
	}, 120_000);
});

const OTHER_DIALECTS = {
	'draft-04': 4,
	'draft-06': 6,
	'2019-09': 2019,
	'2020-12': 2020,
} as const;

describe('other dialects', () => {
	for (const dialect of Object.keys(OTHER_DIALECTS) as (keyof typeof OTHER_DIALECTS)[]) {
		const token = OTHER_DIALECTS[dialect];

		test(`${dialect} matches the recorded baseline`, async () => {
			const { counts, failing } = await measureDialect(
				files,
				token,
				(testCase) =>
					compileToEffectSchema(
						testCase.schema,
						testCase.externalSchemas,
						formatModeFor(testCase),
						dialect
					),
				(schema, data) => decode(schema, data) !== undefined
			);

			expect(
				counts,
				`Failing ${dialect} cases (${failing.length}):\n${failing.join('\n')}`
			).toEqual(baseline[dialect]);
		}, 120_000);
	}
});
