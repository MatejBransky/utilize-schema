// oxlint-disable-next-line import/default -- Vite worker imports have a default export.
import ValidatorWorker from './validator.worker?worker';

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

/**
 * Sends validation requests to the validator worker. A request that does not
 * finish in time, for example because a schema pattern backtracks forever,
 * stops the worker; the next request starts a fresh one.
 */
export class ValidatorClient {
	#worker: Worker | null = null;
	#pending = new Map<number, PendingRequest>();
	#nextId = 0;

	run(
		data: unknown,
		sources: Partial<Record<RuntimeTargetId, ValidatorSource>>
	): Promise<ValidatorReports> {
		const worker = this.#ensureWorker();
		const id = (this.#nextId += 1);

		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() =>
					this.#stop(
						new Error(
							`The generated validators did not finish within ${TIMEOUT_MS / 1000} seconds.`
						)
					),
				TIMEOUT_MS
			);

			this.#pending.set(id, { resolve, reject, timer });
			// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Workers have no target origin.
			worker.postMessage({ id, data, sources } satisfies ValidationRequest);
		});
	}

	dispose() {
		this.#stop(new Error('The validator worker was stopped.'));
	}

	#ensureWorker(): Worker {
		if (!this.#worker) {
			const worker = new ValidatorWorker();

			worker.addEventListener('message', (event: MessageEvent<ValidationResponse>) =>
				this.#settle(event.data)
			);
			worker.addEventListener('error', (event) =>
				this.#stop(new Error(event.message || 'The validator worker failed.'))
			);
			this.#worker = worker;
		}

		return this.#worker;
	}

	#settle(response: ValidationResponse) {
		const pending = this.#pending.get(response.id);

		if (!pending) {
			return;
		}

		this.#pending.delete(response.id);
		clearTimeout(pending.timer);

		if ('error' in response) {
			pending.reject(new Error(response.error));
		} else {
			pending.resolve(response.reports);
		}
	}

	/** Ends the worker and every request still waiting on it. */
	#stop(error: Error) {
		this.#worker?.terminate();
		this.#worker = null;

		for (const pending of this.#pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}

		this.#pending.clear();
	}
}
