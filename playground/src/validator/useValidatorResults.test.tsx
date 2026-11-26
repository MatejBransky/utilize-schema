import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, renderHook } from 'vitest-browser-react';

import type { RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import type { TargetId } from '../targets';
import { createValidatorClient } from './ValidatorClient';
import type { ValidatorClient } from './ValidatorClient';
import { useValidatorResults } from './useValidatorResults';

vi.mock('../monaco/transpile', () => ({ emitJavaScript: vi.fn() }));
vi.mock('./ValidatorClient', () => ({ createValidatorClient: vi.fn() }));

interface HookProps {
	target: TargetId;
	runtime: RuntimeSource;
	data: string;
}

const run = vi.fn<ValidatorClient['run']>();
const cancel = vi.fn<ValidatorClient['cancel']>();
const dispose = vi.fn();

beforeEach(() => {
	vi.mocked(emitJavaScript).mockReset().mockResolvedValue('emitted javascript');
	vi.mocked(createValidatorClient).mockReset().mockReturnValue({ run, cancel, dispose });
	run.mockReset().mockResolvedValue({ zod: { ok: true, issues: [] } });
	cancel.mockReset();
	dispose.mockReset();
});

afterEach(async () => {
	await cleanup();
});

test.each([true, false])('a %s boolean root reports a result without a worker', async (schema) => {
	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: { status: 'generated', code: '', booleanRoot: schema },
				data: '{"value":1}',
			},
		}
	);

	await vi.waitFor(() => expect(hook.result.current.status).toBe('ready'));
	const state = hook.result.current;

	expect(state.status === 'ready' && state.result.ok).toBe(schema);
	expect(state.status === 'ready' && state.result.issues).toEqual(
		schema ? [] : [{ path: '$', message: 'The schema rejects all values.' }]
	);
	expect(emitJavaScript).not.toHaveBeenCalled();
	expect(createValidatorClient).not.toHaveBeenCalled();
	await hook.unmount();
});

test('cleanup cancels posted work when the next state has no runnable validator', async () => {
	run.mockReturnValue(new Promise<never>(() => {}));
	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: { status: 'generated', code: 'code', rootName: 'schema' },
				data: '"valid"',
			},
		}
	);

	await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
	await hook.rerender({
		target: 'zod',
		runtime: { status: 'generated', code: 'code', rootName: 'schema' },
		data: '{',
	});

	await vi.waitFor(() => expect(hook.result.current.status).toBe('invalid-json'));
	expect(cancel).toHaveBeenCalledWith('zod');
	expect(run).toHaveBeenCalledTimes(1);
	await hook.unmount();
});

test('transpiling superseded code does not post stale work to the worker', async () => {
	let resolveOld!: (javascript: string) => void;
	const oldJavascript = new Promise<string>((resolve) => {
		resolveOld = resolve;
	});
	vi.mocked(emitJavaScript).mockImplementation((code) =>
		code === 'old code' ? oldJavascript : Promise.resolve('new javascript')
	);

	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: { status: 'generated', code: 'old code', rootName: 'oldSchema' },
				data: '"old"',
			},
		}
	);

	await vi.waitFor(() => expect(emitJavaScript).toHaveBeenCalledWith('old code'));
	await hook.rerender({
		target: 'zod',
		runtime: { status: 'generated', code: 'new code', rootName: 'newSchema' },
		data: '"new"',
	});
	resolveOld('old javascript');

	await vi.waitFor(() => expect(emitJavaScript).toHaveBeenCalledWith('new code'));
	await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
	expect(run).toHaveBeenCalledWith('new', {
		zod: { javascript: 'new javascript', rootName: 'newSchema' },
	});
	await hook.unmount();
});
