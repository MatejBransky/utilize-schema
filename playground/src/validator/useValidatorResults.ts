import { useEffect, useRef, useState } from 'react';

import type { RuntimeCode, RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import type { RuntimeTargetId } from '../targets';
import type { ValidatorReport, ValidatorSource } from './protocol';
import { ValidatorClient } from './ValidatorClient';

/** What happened to one generated validator. */
export type ValidatorOutcome =
	| { status: 'unavailable'; reason: string }
	| { status: 'checked'; result: ValidatorReport };

export type ValidationState =
	| { status: 'running' }
	| { status: 'unavailable' }
	| { status: 'invalid-json'; message: string }
	| { status: 'error'; message: string }
	| {
			status: 'ready';
			zod: ValidatorOutcome;
			effect: ValidatorOutcome;
	  };

type EmitCache = Map<RuntimeTargetId, { code: string; javascript: Promise<string> }>;

const runtimeTargets: RuntimeTargetId[] = ['zod', 'effect'];

/**
 * Runs the generated runtime validators on the test data in a worker and
 * reports the outcome of each target.
 *
 * @param runtimeCode The generated validators, or `null` when there is no schema.
 * @param busy Whether new code is being generated.
 */
export function useValidatorResults(
	runtimeCode: RuntimeCode | null,
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
		if (!runtimeCode) {
			setState(busy ? { status: 'running' } : { status: 'unavailable' });
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(data);
		} catch (error) {
			setState({ status: 'invalid-json', message: messageOf(error) });
			return;
		}

		let cancelled = false;

		const timer = setTimeout(async () => {
			try {
				const sources = await emitSources(runtimeCode, emitCacheRef.current);
				const client = (clientRef.current ??= new ValidatorClient());
				const reports = await client.run(parsed, sources);

				if (!cancelled) {
					setState({
						status: 'ready',
						zod: outcomeFor(runtimeCode.zod, reports.zod),
						effect: outcomeFor(runtimeCode.effect, reports.effect),
					});
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						status: 'error',
						message: `Could not run the generated validators: ${messageOf(error)}`,
					});
				}
			}
		}, 200);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [runtimeCode, data, busy]);

	return state;
}

async function emitSources(
	runtimeCode: RuntimeCode,
	cache: EmitCache
): Promise<Partial<Record<RuntimeTargetId, ValidatorSource>>> {
	const entries = await Promise.all(
		runtimeTargets.flatMap((target) => {
			const source = runtimeCode[target];

			if (source.status !== 'generated' || !source.rootName) {
				return [];
			}

			const { code, rootName } = source;

			return [
				emitLatest(cache, target, code).then(
					(javascript) => [target, { javascript, rootName }] as const
				),
			];
		})
	);

	return Object.fromEntries(entries);
}

/** Emits each target's latest code once, so editing the test data reuses it. */
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

function outcomeFor(source: RuntimeSource, report: ValidatorReport | undefined): ValidatorOutcome {
	if (source.status === 'failed') {
		return { status: 'unavailable', reason: source.error.message };
	}

	if (!source.rootName) {
		return { status: 'unavailable', reason: 'A boolean root schema has no declaration to run.' };
	}

	return report
		? { status: 'checked', result: report }
		: { status: 'unavailable', reason: 'The validator worker returned no result.' };
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
