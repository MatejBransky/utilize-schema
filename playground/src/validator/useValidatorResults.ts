import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import { isRuntimeTarget, targets } from '../targets';
import type { RuntimeTargetId, TargetId } from '../targets';
import type { ValidatorReport, ValidatorSource } from './protocol';
import { createValidatorClient } from './ValidatorClient';
import type { ValidatorClient } from './ValidatorClient';

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

interface RunContext {
	clientRef: RefObject<ValidatorClient | null>;
	cache: EmitCache;
	setState: (state: ValidationState) => void;
}

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

		if ('status' in runnable) {
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
		return { status: 'unavailable', reason: runtime.error.message };
	}

	if (runtime.rootName) {
		return { target, code: runtime.runtimeCode, rootName: runtime.rootName };
	}

	return {
		status: 'unavailable',
		reason: 'The schema does not expose a runtime declaration to run.',
	};
}

function scheduleRun(runnable: GeneratedValidator, parsed: unknown, context: RunContext) {
	let cancelled = false;

	async function run() {
		try {
			const report = await runValidator(runnable, parsed, context, () => cancelled);

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
	}

	const timer = setTimeout(() => {
		void run();
	}, 200);

	return () => {
		cancelled = true;
		clearTimeout(timer);
		context.clientRef.current?.cancel(runnable.target);
	};
}

async function runValidator(
	runnable: GeneratedValidator,
	parsed: unknown,
	context: RunContext,
	cancelled: () => boolean
): Promise<ValidatorReport | undefined> {
	const source = await emitSource(runnable.target, runnable.code, runnable.rootName, context.cache);

	// Transpiling can finish after newer input has scheduled its own run. Do not
	// post stale work to the worker in that window.
	if (cancelled()) {
		return undefined;
	}

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
