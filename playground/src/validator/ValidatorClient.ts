import type {
	ValidationRequest,
	ValidationResponse,
	ValidatorReports,
	ValidatorSource,
} from './protocol';
import type { RuntimeTargetId } from '../targets';

/** Long enough for the first run, which loads Zod and Effect into the worker. */
const TIMEOUT_MS = 10_000;

interface PendingRequest {
	resolve: (reports: ValidatorReports) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface ValidatorClient {
	run(
		data: unknown,
		sources: Partial<Record<RuntimeTargetId, ValidatorSource>>
	): Promise<ValidatorReports>;
	dispose(): void;
}

/**
 * Sends validation requests to the validator worker. A request that does not
 * finish in time, for example because a schema pattern backtracks forever,
 * stops the worker; the next request starts a fresh one.
 */
export function createValidatorClient(): ValidatorClient {
	const pending = new Map<number, PendingRequest>();
	let nextId = 0;
	const gateway = createWorkerGateway(settle, stop);

	function run(
		data: unknown,
		sources: Partial<Record<RuntimeTargetId, ValidatorSource>>
	): Promise<ValidatorReports> {
		const current = gateway.ensure();
		const id = (nextId += 1);

		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() =>
					stop(
						new Error(
							`The generated validators did not finish within ${TIMEOUT_MS / 1000} seconds.`
						)
					),
				TIMEOUT_MS
			);

			pending.set(id, { resolve, reject, timer });

			// Only the window `postMessage` takes a target origin. An empty
			// transfer list sends nothing to transfer.
			current.postMessage({ id, data, sources } satisfies ValidationRequest, []);
		});
	}

	function dispose() {
		stop(new Error('The validator worker was stopped.'));
	}

	function settle(response: ValidationResponse) {
		settleRequest(response, pending);
	}

	/** Ends the worker and every request still waiting on it. */
	function stop(error: Error) {
		gateway.dispose();
		rejectPending(pending, error);
	}

	return { run, dispose };
}

function settleRequest(response: ValidationResponse, pending: Map<number, PendingRequest>) {
	const request = pending.get(response.id);

	if (!request) {
		return;
	}

	pending.delete(response.id);
	clearTimeout(request.timer);

	if ('error' in response) {
		request.reject(new Error(response.error));
	} else {
		request.resolve(response.reports);
	}
}

function rejectPending(pending: Map<number, PendingRequest>, error: Error) {
	for (const request of pending.values()) {
		clearTimeout(request.timer);
		request.reject(error);
	}

	pending.clear();
}

interface WorkerGateway {
	ensure(): Worker;
	dispose(): void;
}

/** Creates the worker lazily and stops it after a failure, so the next run starts fresh. */
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

				created.addEventListener('message', (event: MessageEvent<ValidationResponse>) =>
					onResponse(event.data)
				);
				created.addEventListener('error', (event) =>
					onFailure(new Error(event.message || 'The validator worker failed.'))
				);
				worker = created;
			}

			return worker;
		},
		dispose() {
			worker?.terminate();
			worker = null;
		},
	};
}
