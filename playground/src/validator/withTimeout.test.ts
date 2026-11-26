import { afterEach, expect, test, vi } from 'vitest';

import { withTimeout } from './withTimeout';

afterEach(() => {
	vi.useRealTimers();
});

test('resolves with the work that finishes in time', async () => {
	await expect(withTimeout(Promise.resolve(7), 50, () => new Error('late'))).resolves.toBe(7);
});

test('rejects when the work takes too long', async () => {
	vi.useFakeTimers();
	const pending = withTimeout(
		new Promise<never>(() => {}),
		1000,
		() => new Error('compile timeout')
	);
	const assertion = expect(pending).rejects.toThrow('compile timeout');

	await vi.advanceTimersByTimeAsync(1000);

	await assertion;
});

test('keeps the original rejection', async () => {
	await expect(
		withTimeout(Promise.reject(new Error('boom')), 1000, () => new Error('late'))
	).rejects.toThrow('boom');
});
