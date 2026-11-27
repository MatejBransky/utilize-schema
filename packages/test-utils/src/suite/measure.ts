import { typecheckCases } from './typecheck';

import type { SuiteCase } from './loadSuite';
import type { CaseModule, TypecheckModule, TypecheckResults } from './typecheck';

export interface RunnableCase {
	testCase: SuiteCase;
	key: string;
}

export interface CaseFailure {
	key: string;
	reasons: string[];
}

export interface MeasureOptions {
	/** Generates the declarations and typed instances for one case. */
	render: (testCase: SuiteCase) => Promise<CaseModule>;
	/** Normalizes a crash message before it is recorded. */
	formatCrash?: (message: string) => string;
}

/**
 * The shared type-level measurement used by every suite runner, so
 * `@utilize/typescript` and the pinned competitors are scored by the same code.
 *
 * A case passes when no spec-valid instance is rejected and no spec-invalid
 * instance is accepted. `typeGaps` counts cases where the only difference is an
 * invalid instance accepted; `gaps` counts crashes, invalid TypeScript and
 * rejected valid instances.
 */
export interface CaseMeasurement {
	passing: number;
	typeGaps: number;
	gaps: number;
	instances: number;
	passingInstances: number;
	validInstances: number;
	passingValidInstances: number;
	invalidInstances: number;
	passingInvalidInstances: number;
	failures: CaseFailure[];
	typeGapKeys: string[];
}

export async function measureCases(
	runnable: readonly RunnableCase[],
	{ render, formatCrash = identity }: MeasureOptions
): Promise<CaseMeasurement> {
	const { modules, crashes } = await renderCases(runnable, render, formatCrash);
	const results = await typecheckCases(modules);

	if (results.unattributed.length > 0) {
		throw new Error(`Unattributed diagnostics:\n${results.unattributed.join('\n')}`);
	}

	return {
		...classifyCases(runnable, crashes, results),
		...countInstances(runnable, modules, results),
	};
}

async function renderCases(
	runnable: readonly RunnableCase[],
	render: MeasureOptions['render'],
	formatCrash: (message: string) => string
) {
	const modules: TypecheckModule[] = [];
	const crashes = new Map<string, string>();

	for (const { testCase, key } of runnable) {
		try {
			modules.push({ key, module: await render(testCase) });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			crashes.set(key, formatCrash(message));
		}
	}

	return { modules, crashes };
}

function classifyCases(
	runnable: readonly RunnableCase[],
	crashes: ReadonlyMap<string, string>,
	results: TypecheckResults
): Pick<CaseMeasurement, 'passing' | 'typeGaps' | 'gaps' | 'failures' | 'typeGapKeys'> {
	const failures: CaseFailure[] = [];
	const typeGapKeys: string[] = [];
	let passing = 0;

	for (const { key } of runnable) {
		const reasons = failureReasons(key, crashes, results);

		if (reasons.length > 0) {
			failures.push({ key, reasons });
			continue;
		}

		if ((results.invalidAccepted.get(key) ?? []).length > 0) {
			typeGapKeys.push(key);
			continue;
		}

		passing++;
	}

	return {
		passing,
		typeGaps: typeGapKeys.length,
		gaps: failures.length,
		failures,
		typeGapKeys,
	};
}

function failureReasons(
	key: string,
	crashes: ReadonlyMap<string, string>,
	results: TypecheckResults
): string[] {
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

	return reasons;
}

function countInstances(
	runnable: readonly RunnableCase[],
	modules: readonly TypecheckModule[],
	results: TypecheckResults
): Pick<
	CaseMeasurement,
	| 'instances'
	| 'passingInstances'
	| 'validInstances'
	| 'passingValidInstances'
	| 'invalidInstances'
	| 'passingInvalidInstances'
> {
	const instances = runnable.reduce((total, entry) => total + entry.testCase.tests.length, 0);
	let passingInstances = 0;
	let validInstances = 0;
	let passingValidInstances = 0;
	let invalidInstances = 0;
	let passingInvalidInstances = 0;

	for (const entry of modules) {
		const rejectedValid = new Set(results.validRejected.get(entry.key) ?? []);
		const acceptedInvalid = new Set(results.invalidAccepted.get(entry.key) ?? []);

		for (const instance of entry.module.instances) {
			const failed = instance.valid
				? rejectedValid.has(instance.index)
				: acceptedInvalid.has(instance.index);

			passingInstances += failed ? 0 : 1;

			if (instance.valid) {
				validInstances++;
				passingValidInstances += failed ? 0 : 1;
			} else {
				invalidInstances++;
				passingInvalidInstances += failed ? 0 : 1;
			}
		}
	}

	return {
		instances,
		passingInstances,
		validInstances,
		passingValidInstances,
		invalidInstances,
		passingInvalidInstances,
	};
}

function identity(message: string) {
	return message;
}
