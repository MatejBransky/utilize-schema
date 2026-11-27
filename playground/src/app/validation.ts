import { isRuntimeTarget, targets } from '../targets';
import type { RuntimeTargetId, TargetId } from '../targets';
import { emitJavaScript } from '../monaco/transpile';
import type { RuntimeSource } from '../generateCode';
import type { ValidatorReport, ValidatorSource } from '../validator/protocol';
import { createValidatorClient } from '../validator/ValidatorClient';
import type { ValidatorClient } from '../validator/ValidatorClient';
import { withTimeout } from '../validator/withTimeout';

const COMPILE_TIMEOUT_MS = 10_000;

export type ValidationState =
	| { status: 'running' }
	| { status: 'unavailable'; reason: string }
	| { status: 'invalid-json'; message: string }
	| { status: 'error'; message: string }
	| { status: 'ready'; result: ValidatorReport };

type EmitCache = Map<RuntimeTargetId, { code: string; javascript: Promise<string> }>;

interface GeneratedValidator {
	target: RuntimeTargetId;
	code: string;
	rootName: string;
}

let client: ValidatorClient | null = null;
const cache: EmitCache = new Map();

/** Stops the worker request a new run replaced, so its result is not awaited. */
export function cancelValidation(target: TargetId) {
	if (isRuntimeTarget(target)) {
		client?.cancel(target);
	}
}

/**
 * Runs the generated validator against the test data. The caller debounces;
 * this resolves to the state the result pane draws.
 */
export async function validateGenerated(
	target: TargetId,
	runtime: RuntimeSource | null,
	data: string
): Promise<ValidationState> {
	const runnable = runnableValidator(target, runtime);

	if ('status' in runnable) {
		return runnable;
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(data);
	} catch (error) {
		return { status: 'invalid-json', message: messageOf(error) };
	}

	try {
		const report = await runValidator(runnable, parsed);

		return report
			? { status: 'ready', result: report }
			: {
					status: 'error',
					message: `The validator worker returned no ${targetLabel(runnable.target)} result.`,
				};
	} catch (error) {
		return {
			status: 'error',
			message: `Could not run the ${targetLabel(runnable.target)} validator: ${messageOf(error)}`,
		};
	}
}

function runnableValidator(
	target: TargetId,
	runtime: RuntimeSource | null
): GeneratedValidator | ValidationState {
	if (!isRuntimeTarget(target)) {
		return {
			status: 'unavailable',
			reason: `The ${targetLabel(target)} generator emits types only, so there is no runtime validator to run.`,
		};
	}

	if (!runtime) {
		return {
			status: 'unavailable',
			reason: 'The schema does not produce a runtime validator for this data.',
		};
	}

	if (runtime.status === 'failed') {
		return { status: 'error', message: runtime.error.message };
	}

	if (runtime.rootName) {
		return { target, code: runtime.runtimeCode, rootName: runtime.rootName };
	}

	return {
		status: 'unavailable',
		reason: 'The schema does not expose a runtime declaration to run.',
	};
}

async function runValidator(
	runnable: GeneratedValidator,
	parsed: unknown
): Promise<ValidatorReport | undefined> {
	const source = await withTimeout(
		emitSource(runnable.target, runnable.code, runnable.rootName),
		COMPILE_TIMEOUT_MS,
		() =>
			new Error(
				`Compiling the generated ${targetLabel(runnable.target)} validator took longer than ${COMPILE_TIMEOUT_MS / 1000} seconds.`
			)
	).catch((error: unknown) => {
		// Drop the hung compile so the next run starts a fresh emit instead of
		// awaiting the same promise again.
		cache.delete(runnable.target);

		throw error;
	});

	client ??= createValidatorClient();

	const reports = await client.run(parsed, { [runnable.target]: source });

	return reports[runnable.target];
}

async function emitSource(
	target: RuntimeTargetId,
	code: string,
	rootName: string
): Promise<ValidatorSource> {
	const javascript = await emitLatest(target, code);

	return { javascript, rootName };
}

function emitLatest(target: RuntimeTargetId, code: string): Promise<string> {
	const cached = cache.get(target);

	if (cached?.code === code) {
		return cached.javascript;
	}

	const javascript = emitJavaScript(code);

	cache.set(target, { code, javascript });
	javascript.catch(() => {
		if (cache.get(target)?.javascript === javascript) {
			cache.delete(target);
		}
	});

	return javascript;
}

function targetLabel(target: TargetId): string {
	return targets.find((item) => item.value === target)?.label ?? target;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
