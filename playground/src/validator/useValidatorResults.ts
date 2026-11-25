import { useEffect, useRef, useState, type RefObject } from 'react';

import type { RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import { isRuntimeTarget, targets, type RuntimeTargetId, type TargetId } from '../targets';
import type { ValidatorReport, ValidatorSource } from './protocol';
import { createValidatorClient, type ValidatorClient } from './ValidatorClient';

/** What happened to the validator of the selected generator. */
export type ValidationState =
	| { status: 'running' }
	| { status: 'unavailable'; reason: string }
	| { status: 'invalid-json'; message: string }
	| { status: 'error'; message: string }
	| { status: 'ready'; result: ValidatorReport };

type EmitCache = Map<RuntimeTargetId, { code: string; javascript: Promise<string> }>;

/** The generated validator to run, once the selected target produces one. */
interface RunnableValidator {
	target: RuntimeTargetId;
	code: string;
	rootName: string;
}

interface RunContext {
	clientRef: RefObject<ValidatorClient | null>;
	cache: EmitCache;
	setState: (state: ValidationState) => void;
}

/**
 * Runs the generated runtime validator of the selected target on the test data
 * in a worker.
 *
 * @param target The generator selected in the playground.
 * @param runtime The generated validator, or `null` when the target has none.
 * @param busy Whether new code is being generated.
 */
export function useValidatorResults(
	target: TargetId,
	runtime: RuntimeSource | null,
	data: string,
	busy: boolean
): ValidationState {
	const [state, setState] = useState<ValidationState>({ status: 'running' });
	const clientRef = useRef<ValidatorClient | null>(null);
	const emitCacheRef = useRef<EmitCache>(new Map());

	useEffect(
		() => () => {
			clientRef.current?.dispose();
			clientRef.current = null;
		},
		[]
	);

	useEffect(() => {
		if (busy) {
			setState({ status: 'running' });
			return;
		}

		const runnable = runnableValidator(target, runtime);

		if (!('code' in runnable)) {
			setState(runnable);
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(data);
		} catch (error) {
			setState({ status: 'invalid-json', message: messageOf(error) });
			return;
		}

		return scheduleRun(runnable, parsed, {
			clientRef,
			cache: emitCacheRef.current,
			setState,
		});
	}, [target, runtime, data, busy]);

	return state;
}

/** The validator to run, or the state that says why there is none. */
function runnableValidator(
	target: TargetId,
	runtime: RuntimeSource | null
): RunnableValidator | ValidationState {
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
		return { status: 'unavailable', reason: runtime.error.message };
	}

	if (!runtime.rootName) {
		return {
			status: 'unavailable',
			reason: 'A boolean root schema has no declaration to run.',
		};
	}

	return { target, code: runtime.code, rootName: runtime.rootName };
}

/** Debounces a run and cancels it when the inputs change first. */
function scheduleRun(runnable: RunnableValidator, parsed: unknown, context: RunContext) {
	let cancelled = false;

	const timer = setTimeout(async () => {
		try {
			const report = await runValidator(runnable, parsed, context);

			if (!cancelled) {
				context.setState(
					report
						? { status: 'ready', result: report }
						: {
								status: 'error',
								message: `The validator worker returned no ${targetLabel(runnable.target)} result.`,
							}
				);
			}
		} catch (error) {
			if (!cancelled) {
				context.setState({
					status: 'error',
					message: `Could not run the ${targetLabel(runnable.target)} validator: ${messageOf(error)}`,
				});
			}
		}
	}, 200);

	return () => {
		cancelled = true;
		clearTimeout(timer);
	};
}

async function runValidator(
	runnable: RunnableValidator,
	parsed: unknown,
	context: RunContext
): Promise<ValidatorReport | undefined> {
	const source = await emitSource(runnable.target, runnable.code, runnable.rootName, context.cache);
	const client = (context.clientRef.current ??= createValidatorClient());
	const reports = await client.run(parsed, { [runnable.target]: source });

	return reports[runnable.target];
}

async function emitSource(
	target: RuntimeTargetId,
	code: string,
	rootName: string,
	cache: EmitCache
): Promise<ValidatorSource> {
	const javascript = await emitLatest(cache, target, code);

	return { javascript, rootName };
}

/** Emits the target's latest code once, so editing the test data reuses it. */
function emitLatest(cache: EmitCache, target: RuntimeTargetId, code: string): Promise<string> {
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
