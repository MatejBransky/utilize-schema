import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { ValidationRequest, ValidationResponse, ValidatorReports } from './protocol';
import type { ValidatorSource } from './protocol';
import { createValidatorClient } from './ValidatorClient';

class MockWorker extends EventTarget {
	static instances: MockWorker[] = [];
	static failNextConstruction = false;
	readonly requests: ValidationRequest[] = [];
	terminated = false;

	constructor() {
		if (MockWorker.failNextConstruction) {
			MockWorker.failNextConstruction = false;
			throw new Error('Worker construction failed.');
		}

		super();
		MockWorker.instances.push(this);
	}

	postMessage(message: ValidationRequest) {
		this.requests.push(message);
	}

	terminate() {
		this.terminated = true;
	}

	emit(response: ValidationResponse) {
		this.dispatchEvent(new MessageEvent('message', { data: response }));
	}
}

function source(javascript: string): ValidatorSource {
	return { javascript, rootName: 'schema' };
}

function start(worker: MockWorker, index = 0): number {
	const id = worker.requests[index].id;
	worker.emit({ id, type: 'started' });
	return id;
}

function finish(worker: MockWorker, index = 0, reports: ValidatorReports = {}) {
	const id = worker.requests[index].id;
	worker.emit({ id, reports });
}

beforeEach(() => {
	vi.useFakeTimers();
	MockWorker.instances = [];
	MockWorker.failNextConstruction = false;
	vi.stubGlobal('Worker', MockWorker);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('the timeout starts only when the worker begins executing a request', async () => {
	const client = createValidatorClient();
	const result = client.run(null, { zod: source('zod source') });
	const worker = MockWorker.instances[0];

	expect(vi.getTimerCount()).toBe(0);
	await vi.advanceTimersByTimeAsync(20_000);
	expect(worker.terminated).toBe(false);

	start(worker);
	expect(vi.getTimerCount()).toBe(1);
	await vi.advanceTimersByTimeAsync(10_000 - 1);
	expect(worker.terminated).toBe(false);

	finish(worker, 0, { zod: { ok: true, issues: [] } });
	await expect(result).resolves.toEqual({ zod: { ok: true, issues: [] } });
	client.dispose();
});

test('a newer run supersedes the same target without rejecting it', async () => {
	const client = createValidatorClient();
	const first = client.run('old', { zod: source('same source') });
	const firstWorker = MockWorker.instances[0];
	start(firstWorker);

	const second = client.run('new', { zod: source('same source') });
	const secondWorker = MockWorker.instances[1];

	await expect(first).resolves.toEqual({});
	expect(firstWorker.terminated).toBe(true);
	expect(secondWorker).not.toBe(firstWorker);
	expect(vi.getTimerCount()).toBe(0);

	// The superseded request's timer cannot kill the newer request while it waits.
	await vi.advanceTimersByTimeAsync(20_000);
	expect(secondWorker.terminated).toBe(false);

	start(secondWorker);
	finish(secondWorker, 0, { zod: { ok: true, value: 'new', issues: [] } });
	await expect(second).resolves.toEqual({ zod: { ok: true, value: 'new', issues: [] } });
	client.dispose();
});

test('superseding one target preserves the other target from the same request', async () => {
	const client = createValidatorClient();
	const zodSource = source('zod source');
	const effectSource = source('effect source');
	const sources = { zod: zodSource, effect: effectSource };
	const combined = client.run(null, sources);
	const firstWorker = MockWorker.instances[0];
	start(firstWorker);

	const zodOnly = client.run('new', { zod: zodSource });
	const replayWorker = MockWorker.instances[1];

	expect(Object.keys(sources)).toEqual(['zod', 'effect']);
	expect(firstWorker.terminated).toBe(true);
	expect(replayWorker.requests).toHaveLength(2);
	expect(Object.keys(replayWorker.requests[0].sources)).toEqual(['effect']);
	expect(Object.keys(replayWorker.requests[1].sources)).toEqual(['zod']);

	const effectReport = { ok: true, value: 'effect', issues: [] };
	const zodReport = { ok: true, value: 'zod', issues: [] };
	start(replayWorker, 0);
	start(replayWorker, 1);
	finish(replayWorker, 0, { effect: effectReport });
	finish(replayWorker, 1, { zod: zodReport });

	await expect(combined).resolves.toEqual({ effect: effectReport });
	await expect(zodOnly).resolves.toEqual({ zod: zodReport });
	client.dispose();
});

test('cancelling one target replays only the unrelated target from the same request', async () => {
	const client = createValidatorClient();
	const combined = client.run(null, {
		zod: source('zod source'),
		effect: source('effect source'),
	});
	const firstWorker = MockWorker.instances[0];
	start(firstWorker);

	client.cancel('zod');
	const replayWorker = MockWorker.instances[1];

	expect(firstWorker.terminated).toBe(true);
	expect(replayWorker.requests).toHaveLength(1);
	expect(Object.keys(replayWorker.requests[0].sources)).toEqual(['effect']);

	const effectReport = { ok: true, issues: [] };
	start(replayWorker);
	finish(replayWorker, 0, { effect: effectReport });
	await expect(combined).resolves.toEqual({ effect: effectReport });
	client.dispose();
});

test('a timeout rejects only its run and replays another target on a fresh worker', async () => {
	const client = createValidatorClient();
	const sources = { zod: source('zod source'), effect: source('effect source') };
	const initial = client.run(null, sources);
	const initialWorker = MockWorker.instances[0];
	start(initialWorker);
	finish(initialWorker);
	await initial;

	const slow = client.run(null, { zod: sources.zod });
	const slowRejected = expect(slow).rejects.toThrow('did not finish within 10 seconds');
	const fast = client.run(null, { effect: sources.effect });
	const busyWorker = initialWorker;
	const slowId = start(busyWorker, 1);
	const fastId = start(busyWorker, 2);

	await vi.advanceTimersByTimeAsync(10_000);
	await slowRejected;
	expect(busyWorker.terminated).toBe(true);

	const replayWorker = MockWorker.instances[1];
	expect(replayWorker.requests.map((request) => request.id)).toEqual([fastId]);
	expect(replayWorker.requests[0].id).not.toBe(slowId);
	expect(vi.getTimerCount()).toBe(0);

	await vi.advanceTimersByTimeAsync(20_000);
	expect(replayWorker.terminated).toBe(false);
	start(replayWorker);
	finish(replayWorker, 0, { effect: { ok: true, issues: [] } });
	await expect(fast).resolves.toEqual({ effect: { ok: true, issues: [] } });
	client.dispose();
});

test('changing emitted source recycles the worker but repeated data runs reuse it', async () => {
	const client = createValidatorClient();
	const firstSource = source('first source');
	const first = client.run('first', { zod: firstSource });
	const firstWorker = MockWorker.instances[0];
	start(firstWorker);
	finish(firstWorker);
	await first;

	const repeated = client.run('second', { zod: firstSource });
	expect(MockWorker.instances).toHaveLength(1);
	start(firstWorker, 1);
	finish(firstWorker, 1);
	await repeated;

	const changed = client.run('third', { zod: source('changed source') });
	const secondWorker = MockWorker.instances[1];
	expect(firstWorker.terminated).toBe(true);
	expect(secondWorker).not.toBe(firstWorker);
	start(secondWorker);
	finish(secondWorker);
	await changed;
	client.dispose();
});

test('a worker constructor failure removes the request before a retry', async () => {
	const client = createValidatorClient();
	MockWorker.failNextConstruction = true;

	await expect(client.run(null, { zod: source('zod source') })).rejects.toThrow(
		'Worker construction failed.'
	);
	expect(MockWorker.instances).toHaveLength(0);

	const retry = client.run(null, { zod: source('zod source') });
	const worker = MockWorker.instances[0];

	expect(worker.requests).toHaveLength(1);
	start(worker);
	finish(worker);
	await expect(retry).resolves.toEqual({});
	client.dispose();
});

test('a worker constructor failure during replay rejects and removes that request', async () => {
	const client = createValidatorClient();
	const first = client.run(null, { zod: source('zod source') });
	const firstWorker = MockWorker.instances[0];
	const firstRejected = expect(first).rejects.toThrow('Worker construction failed.');
	MockWorker.failNextConstruction = true;

	const second = client.run(null, { effect: source('effect source') });
	const replayWorker = MockWorker.instances[1];

	expect(firstWorker.terminated).toBe(true);
	expect(replayWorker.requests).toHaveLength(1);
	expect(Object.keys(replayWorker.requests[0].sources)).toEqual(['effect']);
	await firstRejected;

	start(replayWorker);
	finish(replayWorker);
	await expect(second).resolves.toEqual({});
	client.dispose();
});

test('events from a replaced worker cannot settle or fail the newest run', async () => {
	const client = createValidatorClient();
	const first = client.run(null, { zod: source('first source') });
	const firstWorker = MockWorker.instances[0];
	start(firstWorker);

	const second = client.run(null, { zod: source('second source') });
	const secondWorker = MockWorker.instances[1];
	await expect(first).resolves.toEqual({});

	const staleError = new Event('error');
	Object.defineProperty(staleError, 'message', { value: 'stale failure' });
	firstWorker.dispatchEvent(staleError);
	const secondId = start(secondWorker);
	finish(secondWorker, 0, { zod: { ok: true, issues: [] } });

	await expect(second).resolves.toEqual({ zod: { ok: true, issues: [] } });
	expect(secondWorker.requests[0].id).toBe(secondId);
	client.dispose();
});
