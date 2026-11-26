// Worker code cannot reach the page DOM, but same-origin storage and fetch remain available.
import { loadModule, validateModule } from '../runtime';
import type { GeneratedModule, RuntimeResult } from '../runtime';
import { runtimeTargetIds } from '../targets';
import type { RuntimeTargetId } from '../targets';
import type {
	ValidationRequest,
	ValidationResponse,
	ValidatorReport,
	ValidatorReports,
	ValidatorSource,
} from './protocol';

const loaded = new Map<RuntimeTargetId, { javascript: string; module: Promise<GeneratedModule> }>();

addEventListener('message', (event: MessageEvent<ValidationRequest>) => {
	void handleMessage(event.data);
});

async function handleMessage({ id, data, sources }: ValidationRequest) {
	postMessage({ id, type: 'started' } satisfies ValidationResponse);

	let response: ValidationResponse;

	try {
		const reports: ValidatorReports = {};

		await Promise.all(
			runtimeTargetIds.map(async (target) => {
				const source = sources[target];

				if (source) {
					reports[target] = await check(target, source, data);
				}
			})
		);

		response = { id, reports };
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

function moduleFor(target: RuntimeTargetId, javascript: string): Promise<GeneratedModule> {
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
