import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { DRAFT_7, isCompatible, OTHER_DIALECTS } from '@utilize/test-utils/suite/compatibility';
import { loadSuiteFiles, suiteCaseKey } from '@utilize/test-utils/suite/loadSuite';
import { measureCases } from '@utilize/test-utils/suite/measure';
import type { RunnableCase } from '@utilize/test-utils/suite/measure';

import { baseline } from './suite/baseline';
import { renderCaseModule } from './suite/generateCase';
import { knownGaps } from './suite/knownGaps';
import { knownGapCases } from './suite/knownGapCases';
import type { CaseGaps, GapDialect } from './suite/knownGapCases';

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
 * - **Type gaps** — the invalid instance is accepted because the only
 *   constraint that would reject it is a keyword a type cannot express
 *   (`minimum`, `pattern`, `format`, `dependencies`, …). These are inherent to
 *   the target, and json-schema-to-typescript records the same kind of gap in
 *   its own baseline.
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

// The generated module uses `satisfies` so it keeps its literal evidence; the
// tests read it through the owner contract.
const gapCases: Record<string, CaseGaps> = knownGapCases;
const files = loadSuiteFiles();
const UPDATE_BASELINE = process.env.UPDATE_SUITE_BASELINE === '1';
const dialectGaps: Record<string, DialectGapData> = {};

interface DialectGapData {
	gaps: { key: string; reason: string }[];
	typeGaps: string[];
}

function isOtherDialect(dialect: string): dialect is keyof typeof OTHER_DIALECTS {
	return Object.hasOwn(OTHER_DIALECTS, dialect);
}

function isGapDialect(dialect: string): dialect is GapDialect {
	return dialect === 'draft-07' || isOtherDialect(dialect);
}

afterAll(() => {
	if (!UPDATE_BASELINE) {
		return;
	}

	if (Object.keys(dialectGaps).length !== 1 + Object.keys(OTHER_DIALECTS).length) {
		console.error('Not writing test/suite/knownGapCases.ts: not every dialect was measured.');
		process.exitCode = 1;
		return;
	}

	writeFileSync(join(__dirname, 'suite/knownGapCases.ts'), renderKnownGapCases(dialectGaps));
	console.log('wrote test/suite/knownGapCases.ts');
});

function gapsForDialect(dialect: GapDialect): string[] {
	return Object.entries(gapCases)
		.flatMap(([key, entry]) => {
			const reason = entry.gaps?.[dialect];

			return reason === undefined ? [] : [`${key}: ${reason}`];
		})
		.sort();
}

function typeGapsForDialect(dialect: GapDialect): string[] {
	return Object.entries(gapCases)
		.filter(([, entry]) => entry.typeGaps?.includes(dialect))
		.map(([key]) => key)
		.sort();
}

function renderKnownGapCases(data: Record<string, DialectGapData>): string {
	const cases = new Map<string, CaseGaps>();

	for (const [dialect, entry] of Object.entries(data)) {
		if (!isGapDialect(dialect)) {
			continue;
		}

		for (const { key, reason } of entry.gaps) {
			const value = cases.get(key) ?? {};

			value.gaps ??= {};
			value.gaps[dialect] = reason;
			cases.set(key, value);
		}

		for (const key of entry.typeGaps) {
			const value = cases.get(key) ?? {};

			value.typeGaps ??= [];
			value.typeGaps.push(dialect);
			cases.set(key, value);
		}
	}

	const body = [...cases.keys()]
		.sort()
		.map((key) => {
			const entry = cases.get(key) ?? {};
			const lines = [`\t${JSON.stringify(key)}: {`];

			if (entry.gaps) {
				const gaps = Object.entries(entry.gaps)
					.map(
						([dialect, reason]) => `\t\t\t${JSON.stringify(dialect)}: ${JSON.stringify(reason)},`
					)
					.join('\n');
				lines.push(`\t\tgaps: {\n${gaps}\n\t\t},`);
			}

			if (entry.typeGaps) {
				const typeGaps = entry.typeGaps
					.sort()
					.map((dialect) => `\t\t\t${JSON.stringify(dialect)},`)
					.join('\n');
				lines.push(`\t\ttypeGaps: [\n${typeGaps}\n\t\t],`);
			}

			lines.push('\t},');
			return lines.join('\n');
		})
		.join('\n');

	return `// Generated by \`pnpm --filter @utilize/typescript update:suite-baseline\`; do not edit by hand.
export type GapDialect = 'draft-04' | 'draft-06' | 'draft-07' | '2019-09' | '2020-12';

export interface CaseGaps {
	/** Dialects where the case crashes, emits invalid TypeScript or rejects a valid instance. */
	gaps?: Partial<Record<GapDialect, string>>;
	/** Dialects where the case differs only because an invalid instance is accepted. */
	typeGaps?: GapDialect[];
}

export const knownGapCases = {
${body}
} satisfies Record<string, CaseGaps>;
`;
}

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

		const measurement = await measureCases(runnable, {
			render: renderCaseModule,
			formatCrash: (message) => message.replaceAll(`${__dirname}/suite/`, ''),
		});
		const { failures, typeGapKeys } = measurement;

		stats.conformant = measurement.passing;
		stats.typeGaps = measurement.typeGaps;
		stats.known = measurement.gaps;
		stats.assertions = measurement.instances;
		stats.passedAssertions = measurement.passingInstances;
		stats.validAssertions = measurement.validInstances;
		stats.validPassed = measurement.passingValidInstances;
		stats.invalidAssertions = measurement.invalidInstances;
		stats.invalidPassed = measurement.passingInvalidInstances;

		dialectGaps['draft-07'] = {
			gaps: failures
				.map(({ key, reasons }) => ({ key, reason: reasons.join('; ') }))
				.sort((left, right) => left.key.localeCompare(right.key)),
			typeGaps: [...typeGapKeys].sort(),
		};

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

		if (measurement.gaps > 0 && process.env.SUITE_VERBOSE === '1') {
			report.push(
				'Known gaps that still apply:',
				...failures.map(({ key, reasons }) => `  - ${key}: ${reasons.join('; ')}`)
			);
		}

		expect(failures.map(({ key }) => key).sort()).toEqual(Object.keys(knownGaps).sort());

		if (!UPDATE_BASELINE) {
			expect(
				dialectGaps['draft-07'].gaps.map(({ key, reason }) => `${key}: ${reason}`).sort()
			).toEqual(gapsForDialect('draft-07'));
			expect(dialectGaps['draft-07'].typeGaps).toEqual(typeGapsForDialect('draft-07'));
			expect(
				{
					cases: runnable.length,
					passing: stats.conformant,
					typeGaps: stats.typeGaps,
					gaps: stats.known,
					instances: stats.assertions,
					passingInstances: stats.passedAssertions,
				},
				[
					`Known gap cases (${measurement.gaps}):`,
					...failures.map(({ key }) => key).sort(),
					`Type gap cases (${typeGapKeys.length}):`,
					...typeGapKeys.sort(),
				].join('\n')
			).toEqual(baseline['draft-07']);
		}
	}, 120_000);
});

describe('other dialects', () => {
	for (const dialect of Object.keys(OTHER_DIALECTS).filter(isOtherDialect)) {
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

			const measurement = await measureCases(runnable, {
				render: (testCase) => renderCaseModule(testCase, dialect),
				// Paths under the suite directory would make the recorded list
				// depend on the machine that generated it.
				formatCrash: (message) => message.replaceAll(`${__dirname}/suite/`, ''),
			});
			const { typeGapKeys } = measurement;
			const gaps = measurement.failures.map(({ key, reasons }) => `${key}: ${reasons.join('; ')}`);

			dialectGaps[dialect] = {
				gaps: measurement.failures
					.map(({ key, reasons }) => ({ key, reason: reasons.join('; ') }))
					.sort((left, right) => left.key.localeCompare(right.key)),
				typeGaps: [...typeGapKeys].sort(),
			};

			if (UPDATE_BASELINE) {
				return;
			}

			const failureMessage = [
				`Failing ${dialect} cases (${measurement.gaps}):`,
				...gaps,
				`Type gap cases (${typeGapKeys.length}):`,
				...typeGapKeys.sort(),
			].join('\n');

			expect(
				{
					cases: runnable.length,
					passing: measurement.passing,
					typeGaps: measurement.typeGaps,
					gaps: measurement.gaps,
					instances: measurement.instances,
					passingInstances: measurement.passingInstances,
				},
				failureMessage
			).toEqual(baseline[dialect]);
			expect([...gaps].sort(), failureMessage).toEqual(gapsForDialect(dialect));
			expect([...typeGapKeys].sort(), failureMessage).toEqual(typeGapsForDialect(dialect));
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
