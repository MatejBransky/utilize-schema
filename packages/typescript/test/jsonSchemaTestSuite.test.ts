import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { baseline } from './suite/baseline';
import { DRAFT_7, isCompatible } from './suite/compatibility';
import { renderCaseModule } from './suite/generateCase';
import { knownGaps } from './suite/knownGaps';
import { loadSuiteFiles, type SuiteCase, suiteCaseKey } from './suite/loadSuite';
import { typecheckCases, type TypecheckModule } from './suite/typecheck';

/**
 * Runs the official JSON Schema Test Suite against the generated TypeScript
 * types.
 *
 * A type cannot validate a value, so conformance here means: every spec-valid
 * instance is accepted by the generated type, and every spec-invalid instance
 * is rejected. Instances are emitted as typed constants next to the generated
 * declarations and checked by one `tsc --strict` run.
 *
 * Three kinds of gaps are reported separately:
 *
 * - **Type gaps** — the invalid instance is rejected only by a keyword a type
 *   cannot express (`minimum`, `pattern`, `format`, `dependencies`, …). These
 *   are inherent to the target, and json-schema-to-typescript records the same
 *   kind of gap in its own baseline.
 * - **Inference gaps** — a schema without `type` infers the intended type from
 *   its keywords, so instances of other JSON types are rejected. This is a
 *   deliberate trade-off shared with json-schema-to-typescript: without it,
 *   `{ properties: … }` would have to become `unknown`.
 * - **Structural gaps** — crashes, invalid TypeScript or rejected valid
 *   instances that inference does not explain. Those are bugs, and every one is
 *   listed in `suite/knownGaps.ts`.
 *
 * The recorded baseline is a claim that the generator does not regress, like
 * json-schema-to-typescript's own conformance baseline. Raise it on purpose
 * when conformance improves.
 */

const files = loadSuiteFiles();

const stats = {
	cases: 0,
	conformant: 0,
	typeGaps: 0,
	known: 0,
	assertions: 0,
	passedAssertions: 0,
	validAssertions: 0,
	validPassed: 0,
	invalidAssertions: 0,
	invalidPassed: 0,
	skippedFormat: 0,
	skippedDialect: 0,
};

let report: string[] = [];

beforeAll(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
	vi.restoreAllMocks();
	console.log(report.join('\n'));
});

interface RunnableCase {
	testCase: SuiteCase;
	key: string;
}

describe('JSON Schema Test Suite (draft-07, type level)', () => {
	test('matches the recorded conformance baseline', async () => {
		const runnable: RunnableCase[] = [];

		for (const file of files) {
			for (const testCase of file.cases) {
				stats.cases++;

				if (!isCompatible(testCase.compatibility, DRAFT_7)) {
					stats.skippedDialect++;
					continue;
				}

				// A type cannot check a format either way, so assertion cases are
				// measured by the runtime generators instead of here.
				if (testCase.tags?.includes('format-assertion')) {
					stats.skippedFormat++;
					continue;
				}

				runnable.push({ testCase, key: suiteCaseKey(file, testCase) });
			}
		}

		const modules: TypecheckModule[] = [];
		const crashes = new Map<string, string>();

		for (const { testCase, key } of runnable) {
			try {
				modules.push({ key, module: await renderCaseModule(testCase) });
			} catch (error) {
				crashes.set(key, error instanceof Error ? error.message : String(error));
			}
		}

		const results = await typecheckCases(modules);
		const failures = new Map<string, string[]>();

		for (const { key } of runnable) {
			const reasons: string[] = [];
			const crash = crashes.get(key);

			if (crash !== undefined) {
				reasons.push(`crashes: ${crash.split('\n')[0]}`);
			}

			for (const message of results.invalidModules.get(key) ?? []) {
				reasons.push(`invalid TypeScript: ${message}`);
			}

			for (const index of results.validRejected.get(key) ?? []) {
				reasons.push(`rejects valid instance ${index}`);
			}

			if (reasons.length > 0) {
				failures.set(key, reasons);
				continue;
			}

			if ((results.invalidAccepted.get(key) ?? []).length > 0) {
				stats.typeGaps++;
				continue;
			}

			stats.conformant++;
		}

		stats.assertions = modules.reduce((total, entry) => total + entry.module.instances.length, 0);
		stats.known = failures.size;

		for (const entry of modules) {
			const rejectedValid = new Set(results.validRejected.get(entry.key) ?? []);
			const acceptedInvalid = new Set(results.invalidAccepted.get(entry.key) ?? []);

			for (const instance of entry.module.instances) {
				const failed = instance.valid
					? rejectedValid.has(instance.index)
					: acceptedInvalid.has(instance.index);

				if (instance.valid) {
					stats.validAssertions++;
					stats.validPassed += failed ? 0 : 1;
				} else {
					stats.invalidAssertions++;
					stats.invalidPassed += failed ? 0 : 1;
				}

				stats.passedAssertions += failed ? 0 : 1;
			}
		}

		report = [
			[
				'JSON Schema Test Suite (draft-07, type level)',
				`${stats.conformant}/${runnable.length} cases conformant`,
				`${stats.validPassed}/${stats.validAssertions} valid accepted`,
				`${stats.invalidPassed}/${stats.invalidAssertions} invalid rejected`,
				`${stats.typeGaps} type gaps`,
				`${stats.known} known gaps`,
				`${stats.skippedFormat} skipped (format assertion)`,
				`${stats.skippedDialect} outside this dialect (measured in the baseline)`,
			].join(' · '),
		];

		if (failures.size > 0 && process.env.SUITE_VERBOSE === '1') {
			report.push(
				'Known gaps that still apply:',
				...[...failures].map(([key, reasons]) => `  - ${key}: ${reasons.join('; ')}`)
			);
		}

		expect(results.unattributed).toEqual([]);
		// eslint-disable-next-line unicorn/no-array-sort -- both arrays are fresh
		const recorded = baseline['draft-07'];

		expect([...failures.keys()].sort()).toEqual(Object.keys(knownGaps).sort());
		expect(runnable.length).toBe(recorded.cases);
		expect(stats.conformant).toBe(recorded.passing);
		expect(stats.typeGaps).toBe(recorded.typeGaps);
		expect(stats.known).toBe(recorded.gaps);
	}, 120_000);
});

const OTHER_DIALECTS = {
	'draft-04': 4,
	'draft-06': 6,
	'2019-09': 2019,
	'2020-12': 2020,
} as const;

describe('other dialects', () => {
	for (const dialect of Object.keys(OTHER_DIALECTS) as Array<keyof typeof OTHER_DIALECTS>) {
		const token = OTHER_DIALECTS[dialect];

		test(`${dialect} matches the recorded baseline`, async () => {
			const runnable: RunnableCase[] = [];

			for (const file of files) {
				for (const testCase of file.cases) {
					if (!isCompatible(testCase.compatibility, token)) {
						continue;
					}

					if (testCase.tags?.includes('format-assertion')) {
						continue;
					}

					runnable.push({ testCase, key: suiteCaseKey(file, testCase) });
				}
			}

			const modules: TypecheckModule[] = [];
			const crashes = new Map<string, string>();

			for (const { testCase, key } of runnable) {
				try {
					modules.push({ key, module: await renderCaseModule(testCase, dialect) });
				} catch (error) {
					crashes.set(key, error instanceof Error ? error.message : String(error));
				}
			}

			const results = await typecheckCases(modules);
			let passing = 0;
			let typeGaps = 0;
			const gaps: string[] = [];

			for (const { key } of runnable) {
				const reasons: string[] = [];
				const crash = crashes.get(key);

				if (crash !== undefined) {
					reasons.push(`crashes: ${crash.split('\n')[0]}`);
				}

				for (const message of results.invalidModules.get(key) ?? []) {
					reasons.push(`invalid TypeScript: ${message}`);
				}

				for (const index of results.validRejected.get(key) ?? []) {
					reasons.push(`rejects valid instance ${index}`);
				}

				if (reasons.length > 0) {
					gaps.push(`${key}: ${reasons.join('; ')}`);
					continue;
				}

				if ((results.invalidAccepted.get(key) ?? []).length > 0) {
					typeGaps++;
					continue;
				}

				passing++;
			}

			expect(results.unattributed).toEqual([]);
			expect(
				{ cases: runnable.length, passing, typeGaps, gaps: gaps.length },
				`Failing ${dialect} cases (${gaps.length}):\n${gaps.join('\n')}`
			).toEqual(baseline[dialect as keyof typeof baseline]);
		}, 120_000);
	}
});

describe('known gaps', () => {
	test('describe cases that exist in the suite', () => {
		const keys = new Set(
			files.flatMap((file) => file.cases.map((testCase) => suiteCaseKey(file, testCase)))
		);

		expect(Object.keys(knownGaps).filter((key) => !keys.has(key))).toEqual([]);
	});
});
