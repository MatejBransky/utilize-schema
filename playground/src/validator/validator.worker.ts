/**
 * Runs the generated validators away from the page. Their code is built from
 * schemas that can come from a shared URL, so it is untrusted: in a worker it
 * cannot reach the page, its storage or the editors, and a validator that never
 * finishes can be stopped without freezing the page.
 */
import { loadModule, validateModule, type RuntimeResult } from '../runtime';
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

addEventListener('message', async (event: MessageEvent<ValidationRequest>) => {
	const { id, data, sources } = event.data;
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
});

async function check(
	target: RuntimeTargetId,
	source: ValidatorSource,
	data: unknown
): Promise<ValidatorReport> {
	try {
		const module = await moduleFor(target, source.javascript);

		return toReport(validateModule(target, module, source.rootName, data));
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
