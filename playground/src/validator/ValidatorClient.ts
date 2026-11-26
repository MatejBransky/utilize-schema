import type {
	ValidationRequest,
	ValidationResponse,
	ValidatorReports,
	ValidatorSource,
} from './protocol';
import type { RuntimeTargetId } from '../targets';

/** Long enough for the first run, which loads the selected runtime into the worker. */
const TIMEOUT_MS = 10_000;

interface PendingRequest {
	id: number;
	data: unknown;
	sources: Partial<Record<RuntimeTargetId, ValidatorSource>>;
	targets: Set<RuntimeTargetId>;
	resolve: (reports: ValidatorReports) => void;
	reject: (error: Error) => void;
	timer?: ReturnType<typeof setTimeout>;
	started: boolean;
}

export interface ValidatorClient {
	run(
		data: unknown,
		sources: Partial<Record<RuntimeTargetId, ValidatorSource>>
	): Promise<ValidatorReports>;
	cancel(target: RuntimeTargetId): void;
	dispose(): void;
}

/**
 * Sends validation requests to the validator worker. A newer run supersedes
 * pending runs for the same target. Superseded runs resolve without reports and
 * the worker is recycled so stale queued work cannot occupy it.
 *
 * The timeout starts when the worker acknowledges that execution has begun.
 * A timed-out run stops the worker; unrelated pending runs are replayed on a
 * fresh worker instead of being rejected with it.
 */
export function createValidatorClient(): ValidatorClient {
	const pending = new Map<number, PendingRequest>();
	const loadedSources = new Map<RuntimeTargetId, string>();
	let nextId = 0;
	const gateway = createWorkerGateway(settle, stop);

	function run(
		data: unknown,
		sources: Partial<Record<RuntimeTargetId, ValidatorSource>>
	): Promise<ValidatorReports> {
		const id = (nextId += 1);
		const targets = new Set(Object.keys(sources) as RuntimeTargetId[]);

		return new Promise((resolve, reject) => {
			const superseded = supersedePending(targets);
			let sourceChanged = false;

			for (const target of targets) {
				if (loadedSources.get(target) !== sources[target]!.javascript) {
					sourceChanged = true;
					break;
				}
			}

			// A changed source would leave its old data: URL module retained by the
			// worker. Recycle before posting it; replay unrelated in-flight targets.
			if (superseded > 0 || sourceChanged) {
				restartWorker();
			}

			const request: PendingRequest = {
				id,
				data,
				sources: { ...sources },
				targets,
				resolve,
				reject,
				started: false,
			};

			pending.set(id, request);
			postRequest(request);
		});
	}

	function cancel(target: RuntimeTargetId) {
		if (supersedePending(new Set([target])) > 0) {
			restartWorker();
		}
	}

	function dispose() {
		stop(new Error('The validator worker was stopped.'));
	}

	function settle(response: ValidationResponse) {
		const request = pending.get(response.id);

		if (!request) {
			return;
		}

		if ('type' in response && response.type === 'started') {
			if (request.started) {
				return;
			}

			request.started = true;
			request.timer = setTimeout(
				() =>
					failRequest(
						request.id,
						new Error(
							`The generated validators did not finish within ${TIMEOUT_MS / 1000} seconds.`
						)
					),
				TIMEOUT_MS
			);
			return;
		}

		pending.delete(response.id);
		clearTimer(request);

		if ('reports' in response) {
			request.resolve(reportsFor(request, response.reports));
		} else if ('error' in response) {
			request.reject(new Error(response.error));
		}
	}

	/** Removes only superseded targets, keeping unrelated work from the same request. */
	function supersedePending(targets: ReadonlySet<RuntimeTargetId>): number {
		let count = 0;

		for (const request of pending.values()) {
			let removed = false;

			for (const target of targets) {
				if (!request.targets.delete(target)) {
					continue;
				}

				delete request.sources[target];
				removed = true;
				count += 1;
			}

			if (removed && request.targets.size === 0) {
				pending.delete(request.id);
				clearTimer(request);
				request.resolve({});
			}
		}

		return count;
	}

	/** Rejects only the timed-out run, then gives other targets a fresh worker. */
	function failRequest(id: number, error: Error) {
		const request = pending.get(id);

		if (!request) {
			return;
		}

		pending.delete(id);
		clearTimer(request);
		request.reject(error);
		restartWorker();
	}

	function postRequest(request: PendingRequest) {
		try {
			const worker = gateway.ensure();

			// Only the window `postMessage` takes a target origin. An empty
			// transfer list sends nothing to transfer.
			worker.postMessage(
				{
					id: request.id,
					data: request.data,
					sources: request.sources,
				} satisfies ValidationRequest,
				[]
			);
		} catch (error) {
			pending.delete(request.id);
			clearTimer(request);
			request.reject(error instanceof Error ? error : new Error(String(error)));
			return;
		}

		for (const [target, source] of Object.entries(request.sources)) {
			loadedSources.set(target as RuntimeTargetId, source.javascript);
		}
	}

	function replayPending() {
		for (const request of pending.values()) {
			clearTimer(request);
			request.started = false;
			postRequest(request);
		}
	}

	function restartWorker() {
		gateway.dispose();
		loadedSources.clear();
		replayPending();
	}

	/** Ends the worker and every request still waiting on it. */
	function stop(error: Error) {
		gateway.dispose();
		loadedSources.clear();
		rejectPending(pending, error);
	}

	return { run, cancel, dispose };
}

function reportsFor(request: PendingRequest, reports: ValidatorReports): ValidatorReports {
	const selected: ValidatorReports = {};

	for (const target of request.targets) {
		const report = reports[target];

		if (report !== undefined) {
			selected[target] = report;
		}
	}

	return selected;
}

function clearTimer(request: PendingRequest) {
	if (request.timer !== undefined) {
		clearTimeout(request.timer);
		request.timer = undefined;
	}
}

function rejectPending(pending: Map<number, PendingRequest>, error: Error) {
	for (const request of pending.values()) {
		clearTimer(request);
		request.reject(error);
	}

	pending.clear();
}

interface WorkerGateway {
	ensure(): Worker;
	dispose(): void;
}

/** Creates the worker lazily and ignores events from workers that were replaced. */
function createWorkerGateway(
	onResponse: (response: ValidationResponse) => void,
	onFailure: (error: Error) => void
): WorkerGateway {
	let worker: Worker | null = null;

	return {
		ensure() {
			if (!worker) {
				const created = new Worker(new URL('./validator.worker.ts', import.meta.url), {
					type: 'module',
				});

				created.addEventListener('message', (event: MessageEvent<ValidationResponse>) => {
					if (worker === created) {
						onResponse(event.data);
					}
				});
				created.addEventListener('error', (event) => {
					if (worker === created) {
						onFailure(new Error(event.message || 'The validator worker failed.'));
					}
				});
				worker = created;
			}

			return worker;
		},
		dispose() {
			const previous = worker;
			worker = null;
			previous?.terminate();
		},
	};
}
