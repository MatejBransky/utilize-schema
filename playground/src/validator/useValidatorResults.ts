import { useEffect, useRef, useState } from 'react';

import type { RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import { isRuntimeTarget, targets, type RuntimeTargetId, type TargetId } from '../targets';
import type { ValidatorReport, ValidatorSource } from './protocol';
import { ValidatorClient } from './ValidatorClient';

/** What happened to the validator of the selected generator. */
export type ValidationState =
	| { status: 'running' }
	| { status: 'unavailable'; reason: string }
	| { status: 'invalid-json'; message: string }
	| { status: 'error'; message: string }
	| { status: 'ready'; result: ValidatorReport };

type EmitCache = Map<RuntimeTargetId, { code: string; javascript: Promise<string> }>;

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

		if (!isRuntimeTarget(target)) {
			setState({
				status: 'unavailable',
				reason: `The ${targetLabel(target)} generator emits types only, so there is no runtime validator to run.`,
			});
			return;
		}

		if (!runtime) {
			setState({
				status: 'unavailable',
				reason: 'The schema does not produce a runtime validator for this data.',
			});
			return;
		}

		if (runtime.status === 'failed') {
			setState({ status: 'unavailable', reason: runtime.error.message });
			return;
		}

		if (!runtime.rootName) {
			setState({
				status: 'unavailable',
				reason: 'A boolean root schema has no declaration to run.',
			});
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(data);
		} catch (error) {
			setState({ status: 'invalid-json', message: messageOf(error) });
			return;
		}

		const { code, rootName } = runtime;
		let cancelled = false;

		const timer = setTimeout(async () => {
			try {
				const source = await emitSource(target, code, rootName, emitCacheRef.current);
				const client = (clientRef.current ??= new ValidatorClient());
				const reports = await client.run(parsed, { [target]: source });
				const report = reports[target];

				if (!cancelled) {
					setState(
						report
							? { status: 'ready', result: report }
							: {
									status: 'error',
									message: `The validator worker returned no ${targetLabel(target)} result.`,
								}
					);
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						status: 'error',
						message: `Could not run the ${targetLabel(target)} validator: ${messageOf(error)}`,
					});
				}
			}
		}, 200);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [target, runtime, data, busy]);

	return state;
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
