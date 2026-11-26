import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { loadModule, validateModule } from '../runtime';
import type { ValidationRequest } from './protocol';

vi.mock('../runtime', () => ({
	loadModule: vi.fn(),
	validateModule: vi.fn(),
}));

let handleMessage: ((event: MessageEvent<ValidationRequest>) => void) | undefined;
const postMessage = vi.fn();

beforeEach(async () => {
	vi.resetModules();
	vi.mocked(loadModule).mockReset();
	vi.mocked(validateModule).mockReset();
	postMessage.mockReset();
	vi.stubGlobal('postMessage', postMessage);
	vi.stubGlobal('addEventListener', (_type: string, listener: typeof handleMessage) => {
		handleMessage = listener;
	});

	await import('./validator.worker');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

test('acknowledges execution before waiting for a generated module', async () => {
	let resolveModule!: (module: Record<string, unknown>) => void;
	vi.mocked(loadModule).mockReturnValue(
		new Promise((resolve) => {
			resolveModule = resolve;
		})
	);
	vi.mocked(validateModule).mockResolvedValue({ ok: false, issues: [] });
	const request: ValidationRequest = {
		id: 7,
		data: null,
		sources: { zod: { javascript: 'generated javascript', rootName: 'schema' } },
	};

	handleMessage!(new MessageEvent('message', { data: request }));

	expect(postMessage).toHaveBeenCalledTimes(1);
	expect(postMessage).toHaveBeenCalledWith({ id: 7, type: 'started' });

	resolveModule({});
	await vi.waitFor(() => {
		expect(postMessage).toHaveBeenLastCalledWith({
			id: 7,
			reports: { zod: { ok: false, issues: [] } },
		});
	});
});
