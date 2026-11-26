/**
 * Runs untrusted generated validators in a dedicated, same-origin worker. The
 * code cannot reach the page DOM, localStorage or the editors, and a validator
 * that never finishes can be stopped without freezing the page.
 *
 * This is not a security sandbox: worker code can still use IndexedDB, the Cache
 * API, BroadcastChannel and credentialed same-origin fetch.
 */
import { loadModule, validateModule } from '../runtime';
import type { RuntimeResult } from '../runtime';
import type { RuntimeTargetId } from '../targets';
import type {
	ValidationRequest,
	ValidationResponse,
	ValidatorReport,
	ValidatorSource,
} from './protocol';

/** The latest module of each target, so editing the test data does not load it again. */
const loaded = new Map<
	RuntimeTargetId,
	{ javascript: string; module: Promise<Record<string, unknown>> }
>();

addEventListener('message', (event: MessageEvent<ValidationRequest>) => {
	void handleMessage(event.data);
});

async function handleMessage({ id, data, sources }: ValidationRequest) {
	postMessage({ id, type: 'started' } satisfies ValidationResponse);

	let response: ValidationResponse;

	try {
		const targets = Object.keys(sources) as RuntimeTargetId[];
		const reports = await Promise.all(
			targets.map(async (target) => [target, await check(target, sources[target]!, data)] as const)
		);

		response = { id, reports: Object.fromEntries(reports) };
	} catch (error) {
		response = { id, error: messageOf(error) };
	}

	postMessage(response);
}

async function check(
	target: RuntimeTargetId,
	source: ValidatorSource,
	data: unknown
): Promise<ValidatorReport> {
	try {
		const module = await moduleFor(target, source.javascript);

		return toReport(await validateModule(target, module, source.rootName, data));
	} catch (error) {
		return { ok: false, issues: [], error: messageOf(error) };
	}
}

function moduleFor(target: RuntimeTargetId, javascript: string): Promise<Record<string, unknown>> {
	const cached = loaded.get(target);

	if (cached?.javascript === javascript) {
		return cached.module;
	}

	const module = loadModule(javascript);

	loaded.set(target, { javascript, module });
	module.catch(() => {
		if (loaded.get(target)?.module === module) {
			loaded.delete(target);
		}
	});

	return module;
}

/** Decoded values can hold anything, so they cross to the page as text. */
function toReport({ value, ...result }: RuntimeResult): ValidatorReport {
	return result.ok ? { ...result, value: formatValue(value) } : result;
}

function formatValue(value: unknown): string {
	if (value === undefined) {
		return 'undefined';
	}

	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
